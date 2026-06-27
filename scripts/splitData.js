import fs from 'fs/promises';
import { MOCK_TOPICS, INTERESTS, TOPIC_GRADIENTS, MOCK_READING_CARDS } from '../src/mockData.js';

async function main() {
  const updatedTopics = MOCK_TOPICS.map(topic => {
    const { thumbnail_query, card_count, ...rest } = topic;
    return {
      ...rest,
      // For black holes, use the mock reading cards as an example. For everything else, use an empty array placeholder.
      content: topic.id === 'black-holes-explained' ? MOCK_READING_CARDS : []
    };
  });

  const topicsFile = `export const TOPICS = ${JSON.stringify(updatedTopics, null, 2)};\n`;
  const interestsFile = `export const INTERESTS = ${JSON.stringify(INTERESTS, null, 2)};\n`;
  const gradientsFile = `export const TOPIC_GRADIENTS = ${JSON.stringify(TOPIC_GRADIENTS, null, 2)};\n`;

  await fs.writeFile('./src/data/topics.js', topicsFile);
  await fs.writeFile('./src/data/interests.js', interestsFile);
  await fs.writeFile('./src/data/gradients.js', gradientsFile);
  
  console.log('Split complete!');
}

main();
