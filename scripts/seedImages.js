import fs from 'fs/promises';
import { TOPICS } from '../src/mockData.js';

const PEXELS_API_KEY = process.env.VITE_PEXELS_API_KEY;

function extractKeyword(title) {
  const stopwords = ['how', 'does', 'the', 'a', 'an', 'work', 'what', 'is', 'why', 'are', 'of', 'in', 'do', 'to', 'and', 'or', 'on', 'with', 'about', 'can'];
  const keyword = title
    .split(' ')
    .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(w => w && !stopwords.includes(w.toLowerCase()))
    .join(' ');
  return keyword || title;
}

async function fetchImage(title) {
  const keyword = extractKeyword(title);
  const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=1&orientation=landscape`;
  
  const res = await fetch(searchUrl, {
    headers: { Authorization: PEXELS_API_KEY }
  });
  
  if (!res.ok) {
    console.error(`Pexels error for ${title}:`, res.statusText);
    return null;
  }
  
  const data = await res.json();
  if (data.photos && data.photos.length > 0) {
    return data.photos[0].src.large || data.photos[0].src.landscape;
  }
  return null;
}

async function main() {
  if (!PEXELS_API_KEY) {
    console.error("Missing VITE_PEXELS_API_KEY. Run with: node --env-file=.env scripts/seedImages.js");
    process.exit(1);
  }

  let fileContent = await fs.readFile('./src/mockData.js', 'utf-8');
  let updatedCount = 0;

  console.log(`Checking ${TOPICS.length} topics...`);

  for (const topic of TOPICS) {
    if (topic.imageUrl) {
      console.log(`Skipping ${topic.title} (already has image)`);
      continue;
    }

    console.log(`Fetching image for: ${topic.title}...`);
    const url = await fetchImage(topic.title);
    
    if (url) {
      // Find the topic block in the file string and insert imageUrl right after the id
      const idRegex = new RegExp(`"id":\\s*"${topic.id}",`);
      if (idRegex.test(fileContent)) {
         fileContent = fileContent.replace(idRegex, `"id": "${topic.id}",\n    "imageUrl": "${url}",`);
         updatedCount++;
         console.log(`  -> Success: ${url}`);
      } else {
         console.warn(`  -> Could not find ID block in file for ${topic.id}`);
      }
    } else {
      console.log(`  -> No image found.`);
    }
    
    // Respect rate limits by sleeping briefly
    await new Promise(r => setTimeout(r, 500));
  }

  if (updatedCount > 0) {
    await fs.writeFile('./src/mockData.js', fileContent);
    console.log(`\nDone! Updated ${updatedCount} topics with images in mockData.js.`);
  } else {
    console.log('\nDone! No new images were added.');
  }
}

main();
