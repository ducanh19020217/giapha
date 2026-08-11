const fetch = require('node-fetch');

const url = 'https://script.google.com/macros/s/AKfycbx-r-4zlofzebwQtlOiJLW1RUhYO7pi9-DprMZvteOEjnlhaGSTha9pz4QnSXqRJmBI/exec';

async function test() {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ action: 'GET_MEMBERS', password: 'admin' })
    });
    const text = await res.text();
    console.log("RESPONSE:", text.substring(0, 500));
  } catch (err) {
    console.error(err);
  }
}

test();
