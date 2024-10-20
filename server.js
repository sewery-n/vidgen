require('dotenv').config();
const express = require('express');
const snoowrap = require('snoowrap');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

const reddit = new snoowrap({
    userAgent: process.env.USER_AGENT,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    username: process.env.REDDIT_USERNAME,
    password: process.env.REDDIT_PASSWORD,
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/upload', upload.single('video'), async (req, res) => {
    console.log('Body:', req.body);
    try {
        const { subreddit } = req.body;

        if (!subreddit) return res.status(400).send('Subreddit name is required');

        const subredditName = await reddit.getSubreddit(subreddit);
        const randomPost = await subredditName.getRandomSubmission();

        const videoPath = req.file.path;
        const title = randomPost.title;
        const content = randomPost.selftext;

        const words = title.split(' ').map(word => String(word).toUpperCase());

        if (content && content.trim().length > 0) {
            const contentWords = content.split(' ').map(word => String(word).toUpperCase());
            words.push(...contentWords);
        }
        console.log(words);

        const outputVideoPath = path.join(__dirname, 'output', 'output.mp4');

        const drawtextFilters = words.map((word, index) => {
            return {
                filter: 'drawtext',
                options: {
                    text: word.replace(/['"]/g, ''),
                    fontfile: '/path/to/font.ttf',
                    fontsize: 48,
                    fontcolor: 'yellow',
                    x: '(main_w/2-text_w/2)',
                    y: '(main_h/2-text_h-10)',
                    shadowcolor: 'black',
                    shadowx: 2,
                    shadowy: 2,
                    borderw: 6,
                    bordercolor: 'black',
                    enable: `between(t,${index * 0.4},${(index + 1) * 0.4})`
                }
            };
        });

        const video = ffmpeg(videoPath)
            .videoFilters(drawtextFilters)
            .on('end', () => res.status(200).send(''))
            .on('error', (err) => {
                console.error(err);
                res.status(500).send('Error processing video');
            })
            .save(outputVideoPath);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching subreddit data');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port: ${PORT}`));