const url = process.env.VITE_GAS_URL || 'https://script.google.com/macros/s/AKfycbwHhxcBLfoPCR8xFFv2u7-cWoxNAZ3gFYwKg737F1fjXOOiifoX2wLm8MhgbHxhlm6l/exec';

async function testGet() {
  console.time('GET_MEMBERS');
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'GET_MEMBERS' })
  });
  await res.text();
  console.timeEnd('GET_MEMBERS');
}

testGet();
