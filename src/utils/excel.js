import * as XLSX from 'xlsx';

/**
 * Parses a candidates Excel file and returns an array of candidates,
 * ranked by column C (النسبة المئوية = percentage).
 * 
 * Tie-breaking: candidates with the same percentage keep the original file order.
 * 
 * Excel structure:
 *   A: الترتيب (original rank / formula - ignored, we recalculate)
 *   B: الاسم  (full name)
 *   C: النسبة المئوية (PERCENTAGE — used for ranking)
 *   D: المجموع 4525 (total score — may be text like "نظام قديم", ignored)
 */
export const parseCandidatesExcel = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Read as array-of-arrays to use column positions (A=0, B=1, C=2, D=3)
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (rows.length < 2) {
          reject(new Error('Excel file is empty or has no data rows'));
          return;
        }

        // Skip header row (row 0), process data rows
        const dataRows = rows.slice(1);

        const parsed = dataRows
          .map((row, fileIndex) => {
            const full_name = (row[1] || '').toString().trim(); // Column B
            const rawPercentage = row[2]; // Column C — النسبة المئوية
            const percentage = (rawPercentage !== '' && rawPercentage !== null)
              ? parseFloat(rawPercentage)
              : null;

            return { full_name, score: percentage, fileIndex };
          })
          .filter(p => p.full_name); // Skip empty rows

        // Sort: highest percentage first. Ties → preserve original file order (stable by fileIndex)
        parsed.sort((a, b) => {
          const scoreA = a.score ?? -Infinity;
          const scoreB = b.score ?? -Infinity;
          if (scoreB !== scoreA) return scoreB - scoreA; // Higher percentage first
          return a.fileIndex - b.fileIndex;             // Same percentage → file order
        });

        // Assign computed rank after sort
        const result = parsed.map((p, i) => ({
          full_name: p.full_name,
          score: p.score ?? 0,
          rank: i + 1,
        }));

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Generic Excel export utility
 */
export const exportToExcel = (data, fileName) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Results');
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};
