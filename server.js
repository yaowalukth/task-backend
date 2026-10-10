require('dotenv').config();
const express = require('express');
const app = express();

const cors = require('cors');
app.use(cors());

// เปิดใช้งานการรับข้อมูลแบบ JSON
app.use(express.json());
const PORT = process.env.PORT || 3000;

//API สมัครสมาชิก (เข้ารหัสผ่าน)
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // นำเอาพาสเวิร์ดไป (Hash) 10 รอบ
        const hashedPassword = await bcrypt.hash(password, 10);

        // สร้างผู้ใช้ใหม่
        const newUser = new User({
            username: username,
            password: hashedPassword
        });

        await newUser.save();

        res.status(201).json({
            message: "สมัครสมาชิกสำเร็จ!"
        });
    } catch (err) {
        res.status(400).json({
            message: "สมัครไม่สำเร็จ (Username อาจจะซ้ำ)",
            error: err.message
        });
    }
});

// API ล็อกอินเพื่อรับ Token
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. ค้นหาผู้ใช้ในฐานข้อมูล
        const user = await User.findOne({ username: username });

        if (!user) {
            return res.status(404).json({
                message: "ไม่พบชื่อผู้ใช้นี้"
            });
        }

        // 2. ตรวจสอบรหัสผ่าน
        const isPasswordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                message: "รหัสผ่านไม่ถูกต้อง!"
            });
        }

        // 3. สร้าง Token ที่มีอายุ 1 ชั่วโมง
        const token = jwt.sign(
            { id: user._id },
            SECRET_KEY,
            { expiresIn: '1h' }
        );

        res.json({
            message: "ล็อกอินสำเร็จ!",
            token: token
        });
    } catch (err) {
        res.status(500).json({
            message: "ระบบขัดข้อง"
        });
    }
});

// Middleware สำหรับตรวจสอบ Token
const verifyToken = (req, res, next) => {
    // 1. รับ Token จาก Header
    const authHeader = req.headers['authorization'];

    // แยก Token ออกจากข้อความ "Bearer <token>"
    const token = authHeader && authHeader.split(' ')[1];

    // 2. ถ้าไม่มี Token ให้ปฏิเสธการเข้าถึง
    if (!token) {
        return res.status(401).json({
            message: "คุณไม่มีสิทธิ์เข้าถึง! (กรุณาล็อกอิน)"
        });
    }

    // 3. ตรวจสอบว่า Token ถูกต้องและยังไม่หมดอายุ
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).json({
                message: "Token ไม่ถูกต้องหรือหมดอายุ!"
            });
        }

        // เก็บข้อมูลผู้ใช้และอนุญาตให้ทำงานต่อ
        req.user = decoded;
        next();
    });
};

// 1. นำไฟล์ db.js มารันเพื่อเชื่อมต่อ Database
require('./db');

// 2. นำพิมพ์เขียว (Model) ที่เราสร้างไว้เข้ามาใช้งาน
const Task = require('./models/Task');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const SECRET_KEY = "process.env.JWT_SECRET";
// ... (จะเขียน API ทั้ง 4 เส้นทางตำแหน่งนี้) ...

// READ (GET): ดึงงานทั้งหมด
app.get('/tasks', async (req, res) => {
    try {
        // รอให้ดึงข้อมูลจาก MongoDB เสร็จ
        const tasks = await Task.find();

        // ส่งข้อมูลกลับเป็น JSON
        res.json(tasks);
    } catch (err) {
        res.status(500).json({
            message: 'ระบบฐานข้อมูลขัดข้อง',
            error: err.message
        });
    }
});

// CREATE (POST): สร้างงานใหม่
app.post('/tasks', async (req, res) => {
    try {
        // นำข้อมูลที่ส่งมาไปสร้างงานใหม่
        const newTask = new Task({
            title: req.body.title,
            priority: req.body.priority
        });

        // รอให้บันทึกลง Database เสร็จ
        await newTask.save();

        // ตอบกลับว่าสร้างสำเร็จ
        res.status(201).json({
            message: 'บันทึกสำเร็จ!',
            task: newTask
        });
    } catch (err) {
        // เช่น ไม่ส่ง title มา หรือข้อมูลไม่ตรงกับ Schema
        res.status(400).json({
            message: 'ข้อมูลไม่ถูกต้อง',
            error: err.message
        });
    }
});

// UPDATE (PUT): แก้ไขสถานะงาน (เสร็จ/ไม่เสร็จ)
app.put('/tasks/:id', async (req, res) => {
    try {
        // ค้นหางานด้วย _id
        const task = await Task.findById(req.params.id);

        // หากหา _id ไม่เจอ ให้ตอบกลับว่าไม่พบข้อมูล
        if (!task) {
            return res.status(404).json({
                message: 'ไม่พบงานหมายเลขนี้'
            });
        }

        // สลับค่า Boolean: true เป็น false / false เป็น true
        task.completed = !task.completed;

        // บันทึกลง Database
        await task.save();

        res.json({
            message: 'อัปเดตสถานะสำเร็จ',
            task: task
        });
    } catch (err) {
        res.status(500).json({
            message: 'ID ผิดรูปแบบ หรือระบบขัดข้อง'
        });
    }
});

// DELETE (ลบงาน)
app.delete('/tasks/:id', verifyToken,async (req, res) => {
    try {
        // ค้นหาด้วย _id แล้วลบทิ้งทันที
        const deletedTask = await Task.findByIdAndDelete(req.params.id);

        if (!deletedTask) {
            return res.status(404).json({
                message: 'ไม่พบงานหมายเลขนี้'
            });
        }

        res.json({
            message: 'ลบงานออกจากระบบเรียบร้อยแล้ว'
        });
    } catch (err) {
        res.status(500).json({
            message: 'ID ผิดรูปแบบ หรือระบบขัดข้อง'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server กำลังรันอยู่ที่พอร์ต ${PORT}`);
});