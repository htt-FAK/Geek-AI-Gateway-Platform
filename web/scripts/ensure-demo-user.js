const { PrismaClient } = require("@prisma/client");
const { PrismaLibSql } = require("@prisma/adapter-libsql");
const path = require("path");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const abs = url.startsWith("file:") && !path.isAbsolute(url.slice(5))
  ? `file:${path.resolve(path.join(__dirname, ".."), url.slice(5).replace(/^\.\//, ""))}`
  : url;

const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: abs }) });

function encryptSecret(plain) {
  const key = Buffer.from(process.env.CREDENTIALS_ENCRYPTION_KEY, "base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

async function main() {
  const count = await prisma.user.count();
  console.log("USER_COUNT=" + count);

  const phone = "13800138000";
  const password = process.env.DEFAULT_USER_PASSWORD || "ChangeMe123";
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    // ensure can login for UI preview: clear mustChangePassword for demo ease
    await prisma.user.update({
      where: { phone },
      data: {
        disabled: false,
        mustChangePassword: false,
        passwordHash: await bcrypt.hash(password, 10),
        passwordVersion: { increment: 1 },
      },
    });
    console.log("DEMO_READY=updated");
  } else {
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        phone,
        passwordHash: hash,
        mustChangePassword: false,
        litellmUserId: "phone:" + phone,
        litellmKeyTokenEnc: encryptSecret("__app_enforced__:phone:" + phone),
      },
    });
    console.log("DEMO_READY=created");
  }
  console.log("DEMO_PHONE=" + phone);
  console.log("DEMO_PASSWORD_SET=yes");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
