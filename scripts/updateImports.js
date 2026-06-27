import fs from 'fs/promises';
import path from 'path';

async function replaceInFile(filepath, replacements) {
  try {
    let content = await fs.readFile(filepath, 'utf8');
    let original = content;
    for (const [search, replace] of replacements) {
      content = content.replaceAll(search, replace);
    }
    if (content !== original) {
      await fs.writeFile(filepath, content);
      console.log(`Updated ${filepath}`);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`Error updating ${filepath}:`, err);
  }
}

async function main() {
  const files = [
    'src/contexts/AuthContext.jsx',
    'src/components/ReadingOverlay.jsx',
    'src/components/TopicCard.jsx',
    'src/components/OnboardingScreen.jsx',
    'src/pages/TimelinePage.jsx',
    'src/pages/SavedPage.jsx',
    'src/pages/ExplorePage.jsx',
    'scripts/seedImages.js'
  ];

  const replacements = [
    ["import { MOCK_TOPICS, INTERESTS } from '../mockData'", "import { TOPICS } from '../data/topics'\nimport { INTERESTS } from '../data/interests'"],
    ["import { TOPIC_GRADIENTS, MOCK_READING_CARDS } from '../mockData'", "import { TOPIC_GRADIENTS } from '../data/gradients'"],
    ["import { TOPIC_GRADIENTS } from '../mockData'", "import { TOPIC_GRADIENTS } from '../data/gradients'"],
    ["import { INTERESTS } from '../mockData'", "import { INTERESTS } from '../data/interests'"],
    ["import { MOCK_TOPICS } from '../mockData'", "import { TOPICS } from '../data/topics'"],
    ["MOCK_TOPICS", "TOPICS"],
    ["MOCK_READING_CARDS", "topic.content"], // This one needs manual fixing later if wrong
    ["import { MOCK_TOPICS } from '../src/mockData.js'", "import { TOPICS } from '../src/data/topics.js'"]
  ];

  for (const file of files) {
    await replaceInFile(file, replacements);
  }
}

main();
