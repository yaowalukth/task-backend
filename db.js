const mongoose = require('mongoose');

// ใส่ Connection String ที่คัดลอกจากข้อมูล MongoDB Atlas ของคุณ
const dbURI = process.env.MONGO_URI;
// เริ่มการเชื่อมต่อ
mongoose.connect(dbURI)
    .then(() => {
        console.log('สำเร็จ! Node.js เชื่อมต่อกับ MongoDB Atlas แล้ว');
    })
    .catch((err) => {
        console.log('พัง! เชื่อมต่อ Database ไม่สำเร็จ:', err);
    });