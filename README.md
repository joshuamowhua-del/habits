# 每日好习惯

给爸爸妈妈用的打卡小程序：吃药（药品 / 保健品）、读书、散步、喝水等习惯打卡，配上小管家「睿睿」、每天十条新闻（可以锁屏听）、背单词、旅行管家和睿睿医生的养生小知识。

- 在 iPhone 上用 Safari 打开网页，点「分享 → 添加到主屏幕」。
- 所有打卡记录只保存在各自的手机里，不会上传。
- 新闻由 `scripts/update_news.py` 每天早晚自动更新（`.github/workflows/news.yml`）；网站由 `.github/workflows/pages.yml` 发布，发布时用 `scripts/news_audio.py`（开源离线语音 Kokoro，柔和男声）把新闻录成 MP3，iPhone 锁屏也能接着听。
- 养生小知识在 `health.js`，每天自动换 3 条，一个多月不重复，应季的优先。
