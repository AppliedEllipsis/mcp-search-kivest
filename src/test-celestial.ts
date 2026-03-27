import { KivestClient } from './kivest-client.js';

const client = new KivestClient({
  apiKey: '',
  requestsPerMinute: 5,
  maxRetries: 3,
});

async function testCelestialEvents() {
  console.log('Testing Celestial Event Queries...\n');
  
  const queries = [
    'What are the next upcoming celestial events in 2024?',
    'When is the next meteor shower visible?',
    'Next solar eclipse dates and locations',
  ];
  
  for (const query of queries) {
    console.log(`Query: ${query}`);
    try {
      const response = await client.search({ query, maxTokens: 500 });
      console.log('Response:', response.choices[0]?.message?.content?.substring(0, 200) + '...\n');
    } catch (error) {
      console.error('Error:', error, '\n');
    }
  }
  
  const stats = await client.getStats();
  console.log('Stats:', JSON.stringify(stats, null, 2));
  
  client.destroy();
}

testCelestialEvents();
