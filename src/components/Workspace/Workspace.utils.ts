export const safeSetLocalStorage = (key: string, value: string) => {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, value);
        }
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new Event('storage-success'));
        }
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(new Event('storage-full'));
            }
        }
        console.error('Storage full:', e);
    }
};

export const isValidEvent = (start: number, end: number) => {
    return typeof start === 'number' && typeof end === 'number' && !isNaN(start) && !isNaN(end) && start >= 0 && end > start;
};

export const detectCSVDelimiter = (text: string): string => {
    const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) || '';
    let inQuotes = false;
    let commas = 0;
    let semicolons = 0;
    let tabs = 0;
    for (let i = 0; i < firstLine.length; i++) {
        const c = firstLine[i];
        if (c === '"') inQuotes = !inQuotes;
        else if (!inQuotes) {
            if (c === ',') commas++;
            else if (c === ';') semicolons++;
            else if (c === '\t') tabs++;
        }
    }
    if (tabs > commas && tabs > semicolons) return '\t';
    if (semicolons > commas) return ';';
    return ',';
};

export const parseCSV = (csvText: string, customDelimiter?: string): string[][] => {
    let cleanText = csvText;
    if (cleanText.charCodeAt(0) === 0xFEFF) {
        cleanText = cleanText.slice(1);
    }
    const delimiter = customDelimiter || detectCSVDelimiter(cleanText);
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentVal = '';
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        if (char === '"') {
            if (inQuotes && cleanText[i + 1] === '"') {
                currentVal += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            currentRow.push(currentVal.trim());
            currentVal = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && cleanText[i + 1] === '\n') {
                i++;
            }
            currentRow.push(currentVal.trim());
            currentVal = '';
            if (currentRow.some(c => c.length > 0)) {
                rows.push(currentRow);
            }
            currentRow = [];
        } else {
            currentVal += char;
        }
    }
    if (currentVal.length > 0 || currentRow.length > 0) {
        currentRow.push(currentVal.trim());
        if (currentRow.some(c => c.length > 0)) {
            rows.push(currentRow);
        }
    }
    return rows;
};

export const parseCSVRow = (str: string, delimiter: string = ',') => {
    let inQuotes = false;
    let currentVal = '';
    const row = [];
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '"' && str[i + 1] === '"') {
            currentVal += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
            row.push(currentVal.trim());
            currentVal = '';
        } else {
            currentVal += char;
        }
    }
    row.push(currentVal.trim());
    return row;
};

export const parseTimeString = (val: string | undefined): number => {
    if (!val) return NaN;
    const clean = val.trim().replace(/^["']|["']$/g, '');
    if (!clean) return NaN;

    if (clean.includes(':')) {
        const parts = clean.split(':').map(p => parseFloat(p.replace(',', '.')));
        if (parts.some(p => isNaN(p))) return NaN;
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        }
    }

    const normalizedNumber = clean.replace(',', '.');
    const num = parseFloat(normalizedNumber);
    return isNaN(num) ? NaN : num;
};
