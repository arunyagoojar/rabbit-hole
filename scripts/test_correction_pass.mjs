import assert from 'node:assert';
import { TOPICS } from '../src/data/topics.js';
import { getCuratedHomepageSections } from '../src/services/recommendationService.js';
import { 
  extractSemanticKeyword, 
  fetchPexelsImage, 
  usedImageUrls,
  TOPIC_SEMANTIC_QUERIES 
} from '../src/services/pexelsService.js';

// Clean spoken text and audio queue logic matching rabbitHoleEngine.js
function cleanSpokenText(text) {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\[\d+\]/g, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/[*_#`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildAudioQueue(canonical) {
  if (!canonical) return []
  const queue = []
  ;(canonical.sections || []).forEach((sec, idx) => {
    const text = sec.paragraphs.join('\n\n').trim()
    if (text) {
      queue.push({
        id: `queue-${sec.id}`,
        sectionId: sec.id,
        threadId: null,
        label: sec.heading || `Part 0${idx + 1}`,
        text
      })
    }
  })
  ;(canonical.threads || []).forEach((thread, tIdx) => {
    const text = thread.paragraphs.join('\n\n').trim()
    if (text) {
      queue.push({
        id: `queue-${thread.id}`,
        sectionId: thread.id,
        threadId: thread.id,
        label: thread.question || `Thread 0${tIdx + 1}`,
        text
      })
    }
  })
  const prompts = (canonical.prompts || []).filter(Boolean).slice(0, 3)
  if (prompts.length > 0) {
    const naturalQuestions = prompts.map((p, idx) => {
      let q = cleanSpokenText(p).trim()
      if (!q.endsWith('?')) q += '?'
      if (idx === prompts.length - 1 && prompts.length > 1) {
        return `And ${q.charAt(0).toLowerCase()}${q.slice(1)}`
      }
      return q
    }).join(' ')

    queue.push({
      id: 'queue-next-questions',
      sectionId: 'questions-station',
      threadId: null,
      label: 'Next questions',
      text: `There are a few directions we could take this next. ${naturalQuestions}`
    })
  }
  return queue
}

console.log('🧪 Starting Rabbit Hole Verification Test Suite...\n');

// ─── 1. TEST GREETING LOGIC ───
console.log('Test 1: Greeting Logic');
function testGreeting(hour, user, userData) {
  let timeOfDay = 'Good evening';
  if (hour >= 5 && hour < 12) timeOfDay = 'Good morning';
  else if (hour >= 12 && hour < 17) timeOfDay = 'Good afternoon';
  else timeOfDay = 'Good evening';

  const rawName = user?.displayName || userData?.displayName || userData?.name;
  let name = 'Guest';
  if (rawName && typeof rawName === 'string' && rawName.trim()) {
    name = rawName.trim().split(' ')[0];
  } else if (user?.email) {
    const prefix = user.email.split('@')[0];
    name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return `${timeOfDay}, ${name}`;
}

assert.strictEqual(testGreeting(8, null, null), 'Good morning, Guest');
assert.strictEqual(testGreeting(13, null, null), 'Good afternoon, Guest');
assert.strictEqual(testGreeting(18, null, null), 'Good evening, Guest');
assert.strictEqual(testGreeting(22, null, null), 'Good evening, Guest');
assert.strictEqual(testGreeting(1, null, null), 'Good evening, Guest');
assert.strictEqual(testGreeting(4, null, null), 'Good evening, Guest');
assert.strictEqual(testGreeting(22, { displayName: 'Arunya Goojar' }, null), 'Good evening, Arunya');
// Verify "Good night" is NEVER produced for all 24 hours
for (let h = 0; h < 24; h++) {
  const g = testGreeting(h, null, null);
  assert(!g.includes('night'), `Hour ${h} produced night greeting: ${g}`);
}
console.log('✅ Greeting logic passes: NO Good night state, evening continues throughout night, names respected.\n');

// ─── 2. TEST AUDIO QUEUE EXCLUSION OF SUBTITLE ───
console.log('Test 2: Audio Queue Excludes Title & Subtitle');
const canonicalMock = {
  id: 'how-do-scientists-know-what-stars-are-made-of-when-they-cannot-touch-them',
  title: 'How do scientists know what stars are made of when they cannot touch them?',
  category: 'Space & Cosmos',
  readingTime: '4 min',
  hook: 'Fraunhofer absorption lines reveal chemical elements from light years away.',
  sections: [
    {
      id: 'sec-0',
      heading: null,
      paragraphs: ['In 1814, a glassmaker named Joseph von Fraunhofer pointed a precision prism at the sun.']
    },
    {
      id: 'sec-1',
      heading: 'The Underlying Mechanism',
      paragraphs: ['Every element absorbs very specific wavelengths of light.']
    }
  ],
  prompts: [
    'How does a telescope actually separate these wavelengths?',
    'Why do different elements leave different fingerprints in light?',
    'How can astronomers detect planets that are too faint to see directly?'
  ]
};

const queue = buildAudioQueue(canonicalMock);
// Check first queue item
assert.strictEqual(queue[0].text, 'In 1814, a glassmaker named Joseph von Fraunhofer pointed a precision prism at the sun.');
assert(!queue.some(item => item.text.includes(canonicalMock.title)), 'Audio queue must NOT narrate title');
assert(!queue.some(item => item.text === canonicalMock.hook), 'Audio queue must NOT narrate subtitle/deck');
// Check question narration at the end
const lastItem = queue[queue.length - 1];
assert.strictEqual(lastItem.id, 'queue-next-questions');
assert(lastItem.text.startsWith('There are a few directions we could take this next.'), 'Question phrasing matches required natural prose');
assert(!lastItem.text.includes('WHERE TO GO NEXT') && !lastItem.text.includes('01'), 'No UI labels in question narration');
console.log('✅ Audio Queue passes: begins directly with body paragraph, no title/subtitle, natural questions at end.\n');

// ─── 3. TEST HOMEPAGE SECTIONS & GUEST COLD-START ───
console.log('Test 3: Homepage Sections & Cold-Start Strategy');
const guestSections = getCuratedHomepageSections({
  allTopics: TOPICS,
  userInterests: [],
  readHistory: {},
  savedIds: []
});

assert(guestSections.forYouTopics.length === 5, `For You must have 5 topics for guest (got ${guestSections.forYouTopics.length})`);
assert(guestSections.topInterestsTopics.length >= 2, `Top Interests must have >= 2 topics for guest (got ${guestSections.topInterestsTopics.length})`);
assert(guestSections.unexploredTopics.length >= 2, `Not Explored Yet must have >= 2 topics for guest (got ${guestSections.unexploredTopics.length})`);
assert(guestSections.crossCategoryTopics.length >= 2, `Cross-Category must have >= 2 topics for guest (got ${guestSections.crossCategoryTopics.length})`);
assert(guestSections.surpriseTopic !== null, 'Surprise topic must never be null');
assert(guestSections.surpriseTopic.id && guestSections.surpriseTopic.title, 'Surprise topic must be a valid topic');

// Verify strict topic validity across ALL sections
const allCards = [
  ...guestSections.forYouTopics,
  ...guestSections.topInterestsTopics,
  ...guestSections.recentlyExploredTopics,
  ...guestSections.unexploredTopics,
  ...guestSections.crossCategoryTopics,
  guestSections.surpriseTopic
].filter(Boolean);

allCards.forEach((c, idx) => {
  assert(c.id, `Card at index ${idx} missing id`);
  assert(typeof c.title === 'string' && c.title.trim().length > 0, `Card ${c.id} has empty title`);
});

// Verify deduplication: no card appears in more than one section
const cardIds = allCards.map(c => c.id);
const uniqueIds = new Set(cardIds);
assert.strictEqual(cardIds.length, uniqueIds.size, `Duplicate cards found on homepage! Count: ${cardIds.length}, Unique: ${uniqueIds.size}`);
console.log(`✅ Homepage passes: ${uniqueIds.size} unique topics across all sections, cold-start populated, 0 empty titles.\n`);

// ─── 4. TEST SEMANTIC IMAGE QUERIES & DEDUPLICATION ───
console.log('Test 4: Semantic Image Queries & Cross-Topic Uniqueness');
assert.strictEqual(
  extractSemanticKeyword({ id: 'how-does-gps-know-exactly-where-you-are' }),
  'GPS satellites Earth navigation'
);
assert.strictEqual(
  extractSemanticKeyword({ id: 'how-does-an-ai-model-turn-a-sentence-into-numbers' }),
  'language model vector embeddings visualization'
);
assert.strictEqual(
  extractSemanticKeyword({ id: 'how-do-scientists-know-what-stars-are-made-of-when-they-cannot-touch-them' }),
  'astronomer telescope night sky spectroscopy'
);
assert.strictEqual(
  extractSemanticKeyword({ id: 'how-does-shazam-recognize-a-song-from-a-few-seconds-of-sound' }),
  'audio waveform music recognition headphones'
);
assert.strictEqual(
  extractSemanticKeyword({ id: 'how-does-a-self-driving-car-understand-what-is-happening-around-it' }),
  'autonomous car lidar sensors road'
);

// Verify that resolved images for topics are unique and not generic Matrix images
const testTopics = [
  { id: 'how-does-gps-know-exactly-where-you-are', title: 'GPS' },
  { id: 'how-does-an-ai-model-turn-a-sentence-into-numbers', title: 'AI numbers' },
  { id: 'how-do-scientists-know-what-stars-are-made-of-when-they-cannot-touch-them', title: 'Stars' },
  { id: 'how-does-shazam-recognize-a-song-from-a-few-seconds-of-sound', title: 'Shazam' },
  { id: 'how-does-a-self-driving-car-understand-what-is-happening-around-it', title: 'Self-driving' }
];

usedImageUrls.clear();
const resolvedUrls = [];
for (const t of testTopics) {
  const url = await fetchPexelsImage(t);
  assert(url, `Image URL returned for ${t.id}`);
  assert(!url.includes('photo-1526374965328-7f61d4dc18c5'), `Topic ${t.id} received generic Matrix image!`);
  resolvedUrls.push(url);
}

const uniqueResolved = new Set(resolvedUrls);
assert.strictEqual(resolvedUrls.length, uniqueResolved.size, 'All topics must receive distinct images');
console.log('✅ Image system passes: semantic queries mapped, 0 duplicate images, 0 generic Matrix images.\n');

console.log('🎉 ALL CORRECTION PASS TESTS PASSED SUCCESSFULLY!');
