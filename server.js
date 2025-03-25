require("dotenv").config();
const express = require("express");
const axios = require("axios");
const puppeteer = require("puppeteer");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get("/auth/facebook", (req, res) => {
  const fbAuthUrl = `https://www.facebook.com/v14.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(process.env.FACEBOOK_REDIRECT_URI)}&scope=public_profile,email`;
  res.redirect(fbAuthUrl);
});

app.get("/auth/facebook/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "Authorization code is missing" });

  try {
    const response = await axios.get(`https://graph.facebook.com/v14.0/oauth/access_token`, {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        code,
      },
    });

    const accessToken = response.data.access_token;
    const userProfileResponse = await axios.get(`https://graph.facebook.com/me`, {
      params: { access_token: accessToken, fields: "id,name,picture,email" },
    });

    const userData = userProfileResponse.data;
    res.json({ success: true, userData, accessToken });
  } catch (error) {
    res.status(500).json({ error: "Failed to authenticate with Facebook" });
  }
});

app.post("/enable-profile-guard", async (req, res) => {
  const { sessionCookie } = req.body;
  if (!sessionCookie) return res.status(400).json({ error: "Session cookie is required" });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setCookie({ name: "c_user", value: sessionCookie, domain: ".facebook.com" });
    await page.goto("https://m.facebook.com/profile_guard/enable", { waitUntil: "networkidle2" });
    const button = await page.$("button");
    if (!button) throw new Error("Profile Guard option is not available in your region");

    await button.click();
    await page.waitForTimeout(3000);

    res.json({ success: true, message: "Profile Guard Enabled!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to enable Profile Guard" });
  } finally {
    await browser.close();
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});
