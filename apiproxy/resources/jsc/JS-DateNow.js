const now = new Date();

const month = (now.getMonth() + 1).toString().padStart(2, '0');
const year = now.getFullYear();
const day = now.getDate().toString().padStart(2, '0');

response.content = JSON.stringify({
  iso: now.toISOString(),
  today: `${year}-${month}-${day}`,
});
