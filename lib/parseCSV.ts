import { readFileSync } from 'fs';
import { join } from 'path';

export async function parseCSV(filePath: string): Promise<{ email: string; points: number }[]> {
  try {
    const absolutePath = join(process.cwd(), 'public', filePath.replace(/^\//, ''));
    console.log('parseCSV: Reading CSV file:', absolutePath);

    const text = readFileSync(absolutePath, 'utf-8').trim();
    console.log('parseCSV: Raw CSV content:', text);

    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length <= 1) {
      throw new Error('CSV file is empty or contains only headers');
    }

    // Handle CSV with potential quotes or extra spaces
    const headers = lines[0].split(',').map(header => header.trim().replace(/^"|"$/g, '').toLowerCase());
    console.log('parseCSV: Headers:', headers);
    const emailIndex = headers.indexOf('email');
    const pointsIndex = headers.indexOf('points');

    if (emailIndex === -1 || pointsIndex === -1) {
      throw new Error('CSV file must contain "email" and "points" columns');
    }

    const data = lines.slice(1).map((line, index) => {
      // Split on commas, but account for quoted fields
      const values = line.split(',').map(value => value.trim().replace(/^"|"$/g, ''));
      console.log(`parseCSV: Line ${index + 1} values:`, values);
      const email = values[emailIndex]?.toLowerCase();
      const points = parseInt(values[pointsIndex], 10);
      return { email, points };
    });

    const validData = data.filter(item => item.email && !isNaN(item.points));
    console.log('parseCSV: Valid data:', validData);
    if (!validData.length) {
      throw new Error('No valid data found in CSV');
    }

    return validData;
  } catch (error) {
    console.error('parseCSV: Error parsing CSV:', {
      filePath,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null,
    });
    throw error;
  }
}