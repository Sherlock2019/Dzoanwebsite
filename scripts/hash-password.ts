import { hashPassword } from "@/lib/auth/password";

// Usage: npm run hash-password -- 'your-long-password'
// Prints a value for OWNER_PASSWORD_HASH. The password itself is never stored.

const password = process.argv[2];
if (!password) {
  console.error("Usage: npm run hash-password -- 'your-long-password'   (12+ characters)");
  process.exit(1);
}
hashPassword(password)
  .then((hash) => console.log(`OWNER_PASSWORD_HASH=${hash}`))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
