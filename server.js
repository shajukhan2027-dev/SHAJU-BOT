const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static('public'));

let codes = {};

app.post('/api/pair', async (req, res) => {
  try {
    const { number } = req.body;
    if(!number) return res.json({success:false});
    // Demo code - Render e Baileys connect hoibo
    let code = Math.random().toString(36).substring(2,6).toUpperCase() + "-" + Math.random().toString(36).substring(2,6).toUpperCase();
    codes[number] = code;
    res.json({ success: true, code: code });
  } catch(e){ res.json({success:false}); }
});

app.get('/', (req,res)=>{ res.sendFile(path.join(__dirname,'public','index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log("SHAJU BOT LIVE on " + PORT));
