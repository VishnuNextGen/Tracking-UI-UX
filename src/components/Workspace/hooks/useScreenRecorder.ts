import { useState, useRef, useCallback } from 'react';
import type React from 'react';
import { getVideoLayout } from '../../../utils/math';
import { getCurrentWatermarkTier } from '../../../utils/userPlanStore';
import { getCreatorWatermarkConfig, hasActiveCreatorWatermark } from '../../../utils/creatorWatermarkStore';
import { preloadCreatorWatermarkImage, renderWatermarkOverlay } from '../../../utils/watermarkRenderer';
import { convertWebmToMp4 } from '../../../utils/videoExport';

export function useScreenRecorder(params: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  projectName: string;
}) {
  const { videoRef, canvasRef, projectName } = params;

  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const [isConvertingToMp4, setIsConvertingToMp4] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordingStateRef = useRef<{ rafId: number; stream: MediaStream } | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const recordingCustomNameRef = useRef<string | null>(null);
  const exportSettingsRef = useRef<{
    active: boolean;
    playlistId: string | null;
    withFreezeFrames: boolean;
    customFileName?: string;
  }>({ active: false, playlistId: null, withFreezeFrames: true });

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('MediaRecorder stop warning:', e);
      }
    }
    if (recordingStateRef.current) {
      cancelAnimationFrame(recordingStateRef.current.rafId);
      if (recordingStateRef.current.stream) {
        recordingStateRef.current.stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {}
        });
      }
      recordingStateRef.current = null;
    }
    recordingStartTimeRef.current = null;
    setIsScreenRecording(false);
  }, []);

  const toggleScreenRecording = async () => {
    setRecordingError(null);
    if (isScreenRecording) {
      stopRecording();
      return;
    }

    try {
      const video = videoRef.current;
      const overlayCanvas = canvasRef.current;

      if (!video || !overlayCanvas) {
        throw new Error('Video or canvas element not available for recording.');
      }

      // Create a composite canvas tailored to the video's intrinsic dimensions for broadcast quality
      const compCanvas = document.createElement('canvas');
      const vWidth = Math.max(
        320,
        video.videoWidth ||
          (video.clientWidth ? Math.round(video.clientWidth * (window.devicePixelRatio || 1)) : 1920)
      );
      const vHeight = Math.max(
        240,
        video.videoHeight ||
          (video.clientHeight ? Math.round(video.clientHeight * (window.devicePixelRatio || 1)) : 1080)
      );
      compCanvas.width = vWidth;
      compCanvas.height = vHeight;
      const ctx =
        compCanvas.getContext('2d', { alpha: false, desynchronized: true }) || compCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas drawing context.');

      const activeWatermarkTier = getCurrentWatermarkTier();
      const initialCreatorWm = getCreatorWatermarkConfig();
      if (initialCreatorWm.imageDataUrl) {
        await preloadCreatorWatermarkImage(initialCreatorWm);
      }

      // Draw initial video frame onto compCanvas
      if (video.readyState >= 2) {
        try {
          ctx.drawImage(video, 0, 0, compCanvas.width, compCanvas.height);
          if (activeWatermarkTier !== 'none' || hasActiveCreatorWatermark(initialCreatorWm)) {
            renderWatermarkOverlay(ctx, {
              tier: activeWatermarkTier,
              targetWidth: compCanvas.width,
              targetHeight: compCanvas.height,
              nowMs: 0,
              creatorWatermark: initialCreatorWm,
            });
          }
        } catch (e) {}
      }

      const stream = (
        compCanvas.captureStream
          ? compCanvas.captureStream(60)
          : (compCanvas as any).mozCaptureStream
            ? (compCanvas as any).mozCaptureStream(60)
            : null
      ) as MediaStream | null;
      if (!stream) {
        throw new Error('Canvas stream capture is not supported in this browser.');
      }

      // Capture audio from video element if available so recording contains sound
      try {
        const videoStream = (video as any).captureStream
          ? (video as any).captureStream()
          : (video as any).mozCaptureStream
            ? (video as any).mozCaptureStream()
            : null;
        if (videoStream) {
          const audioTracks = videoStream.getAudioTracks();
          if (audioTracks && audioTracks.length > 0) {
            audioTracks.forEach((track: MediaStreamTrack) => {
              try {
                stream.addTrack(track);
              } catch {}
            });
          }
        }
      } catch {
        // Non-fatal if audio capture is restricted
      }

      // Prioritize standard MP4 (H.264 / AVC) recording formats supported in Chromium (Chrome 121+, Edge, etc.)
      const possibleTypes = [
        'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
        'video/mp4; codecs=avc1.424028',
        'video/mp4; codecs=avc1',
        'video/mp4; codecs=h264',
        'video/mp4',
        'video/webm; codecs="vp9, opus"',
        'video/webm; codecs="vp8, opus"',
        'video/webm; codecs=vp9',
        'video/webm; codecs=vp8',
        'video/webm',
        '',
      ];

      let recorder: MediaRecorder | null = null;
      let chosenMime = '';

      for (const type of possibleTypes) {
        if (
          type === '' ||
          (typeof MediaRecorder !== 'undefined' &&
            MediaRecorder.isTypeSupported &&
            MediaRecorder.isTypeSupported(type))
        ) {
          try {
            const options: MediaRecorderOptions = {};
            if (type) options.mimeType = type;
            options.videoBitsPerSecond = 14000000; // 14 Mbps broadcast quality
            recorder = new MediaRecorder(stream, options);
            chosenMime = type;
            break;
          } catch (err1) {
            try {
              const options: MediaRecorderOptions = {};
              if (type) options.mimeType = type;
              recorder = new MediaRecorder(stream, options);
              chosenMime = type;
              break;
            } catch (err2) {
              // Try next candidate
            }
          }
        }
      }

      if (!recorder) {
        recorder = new MediaRecorder(stream);
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const format = chosenMime || 'video/mp4';
        const isNativeMp4 = format.toLowerCase().includes('mp4');
        let ext = isNativeMp4 ? 'mp4' : 'webm';

        if (recordedChunksRef.current.length === 0) {
          setIsScreenRecording(false);
          setIsConvertingToMp4(false);
          return;
        }

        const rawBlob = new Blob(recordedChunksRef.current, { type: format });
        recordedChunksRef.current = [];

        let finalBlob: Blob = rawBlob;

        // If the browser did not support native MP4 recording (e.g. Firefox or older Chromium),
        // seamlessly transcode to a standard MP4 file container so the user ALWAYS gets an MP4!
        if (!isNativeMp4) {
          setIsConvertingToMp4(true);
          try {
            const conversionResult = await convertWebmToMp4(rawBlob);
            if (conversionResult.isMp4) {
              finalBlob = conversionResult.blob;
              ext = 'mp4';
            }
          } catch (convErr) {
            console.warn('WebM to MP4 transcoding fallback:', convErr);
          } finally {
            setIsConvertingToMp4(false);
          }
        }

        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;

        const customName = recordingCustomNameRef.current;
        recordingCustomNameRef.current = null;
        const rawBase = customName || projectName || 'telestration-recording';
        const cleanBase = rawBase.replace(/[^a-z0-9_-]/gi, '-').toLowerCase() || 'export-recording';
        a.download = `${cleanBase}-${Date.now()}.${ext}`;
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          if (a.parentNode) a.parentNode.removeChild(a);
        }, 1000);
        setIsScreenRecording(false);
      };

      // Composite rendering loop
      const drawFrame = (now: number) => {
        if (!recordingStateRef.current) return;
        recordingStateRef.current.rafId = requestAnimationFrame(drawFrame);

        if (video.readyState >= 2) {
          try {
            ctx.drawImage(video, 0, 0, compCanvas.width, compCanvas.height);

            // Draw the overlay canvas
            const layout = getVideoLayout(overlayCanvas, video);
            if (layout.w > 0 && layout.h > 0) {
              ctx.drawImage(
                overlayCanvas,
                layout.x,
                layout.y,
                layout.w,
                layout.h,
                0,
                0,
                compCanvas.width,
                compCanvas.height
              );
            }

            // Stamp Tacstem branding watermark + left-bottom Creator Watermark
            const tier = getCurrentWatermarkTier();
            const creatorWm = getCreatorWatermarkConfig();
            if (tier !== 'none' || hasActiveCreatorWatermark(creatorWm)) {
              renderWatermarkOverlay(ctx, {
                tier,
                targetWidth: compCanvas.width,
                targetHeight: compCanvas.height,
                nowMs: now,
                creatorWatermark: creatorWm,
              });
            }
          } catch (renderErr) {
            // Ignore transient frame draw error
          }
        }
      };

      const initialRaf = requestAnimationFrame(drawFrame);
      recordingStateRef.current = { rafId: initialRaf, stream };

      recordedChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();
      recorder.start(500); // 500ms timeslices for reliable chunk buffering
      mediaRecorderRef.current = recorder;
      setIsScreenRecording(true);
    } catch (err: any) {
      console.error('Error starting canvas recording:', err);
      setRecordingError(err.message || 'Failed to start canvas recording.');
      stopRecording();
      throw err;
    }
  };

  return {
    isScreenRecording,
    isConvertingToMp4,
    recordingError,
    setRecordingError,
    mediaRecorderRef,
    recordingStartTimeRef,
    recordingCustomNameRef,
    exportSettingsRef,
    stopRecording,
    toggleScreenRecording,
  };
}
