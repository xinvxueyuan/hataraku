// Measures the sign-in rate limit: 20 concurrent requests must admit exactly 5.
// Run against a real server on loopback, and count real HTTP status codes — a TCP
// connect that merely succeeds proves nothing.
const BASE = process.env.PROBE_BASE ?? "http://127.0.0.1:3101";
const ATTEMPTS = 20;

const signIn = async (index) => {
  const response = await fetch(`${BASE}/api/auth/sign-in/email`, {
    body: JSON.stringify({
      email: `probe-${index}@example.com`,
      password: "definitely-not-the-password",
    }),
    headers: { "content-type": "application/json", origin: BASE },
    method: "POST",
  });

  await response.text();

  return response.status;
};

const statuses = await Promise.all(
  Array.from({ length: ATTEMPTS }, async (_, index) => await signIn(index))
);

const counts = statuses.reduce((tally, status) => {
  tally[status] = (tally[status] ?? 0) + 1;

  return tally;
}, {});

const admitted = statuses.filter((status) => status !== 429).length;
const rejected = statuses.filter((status) => status === 429).length;

console.log("concurrent attempts:", ATTEMPTS);

console.log("status codes:", JSON.stringify(counts));

console.log("admitted (not 429):", admitted);

console.log("rejected (429):", rejected);

console.log(admitted === 5 && rejected === 15 ? "PASS" : "FAIL");
