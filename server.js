const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('.ico')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

app.get('/', (req, res) => {
    res.redirect('/auth-system.html');
});

const EXCEL_FILE = path.join(__dirname, 'data', 'users.xlsx');
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('Created data directory');
}

async function initializeExcel() {
    const workbook = new ExcelJS.Workbook();
    try {
        if (fs.existsSync(EXCEL_FILE)) {
            await workbook.xlsx.readFile(EXCEL_FILE);
        } else {
            console.log('Excel file not found, creating new file');
        }

        if (!workbook.getWorksheet('Users')) {
            const usersWorksheet = workbook.addWorksheet('Users');
            usersWorksheet.columns = [
                { header: 'Username', key: 'username', width: 20 },
                { header: 'Email', key: 'email', width: 30 },
                { header: 'Password', key: 'password', width: 20 },
                { header: 'Registered At', key: 'registeredAt', width: 30 },
                { header: 'Role', key: 'role', width: 15 }
            ];
            console.log('Created Users worksheet');
        } else {
            const usersWorksheet = workbook.getWorksheet('Users');
            const headers = usersWorksheet.getRow(1).values;
            if (!headers.includes('Role')) {
                usersWorksheet.getColumn(5).header = 'Role';
                usersWorksheet.getColumn(5).key = 'role';
                usersWorksheet.getColumn(5).width = 15;
                
                for (let i = 2; i <= usersWorksheet.rowCount; i++) {
                    const row = usersWorksheet.getRow(i);
                    if (!row.getCell(5).value) {
                        row.getCell(5).value = 'user';
                    }
                }
            }
        }

        if (!workbook.getWorksheet('Profiles')) {
            const profilesWorksheet = workbook.addWorksheet('Profiles');
            profilesWorksheet.columns = [
                { header: 'Username', key: 'username' },
                { header: 'Full Name', key: 'fullName' },
                { header: 'Email', key: 'email' },
                { header: 'Phone', key: 'phone' },
                { header: 'Address', key: 'address' },
                { header: 'City', key: 'city' },
                { header: 'State', key: 'state' },
                { header: 'Country', key: 'country' },
                { header: 'Zip Code', key: 'zipCode' },
                { header: 'Last Updated', key: 'lastUpdated' }
            ];
            console.log('Created Profiles worksheet');
        }

        if (!workbook.getWorksheet('Attendance')) {
            const attendanceWorksheet = workbook.addWorksheet('Attendance');
            attendanceWorksheet.columns = [
                { header: 'Username', key: 'username', width: 20 },
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Remarks', key: 'remarks', width: 30 },
                { header: 'Marked By', key: 'markedBy', width: 20 },
                { header: 'Marked At', key: 'markedAt', width: 30 }
            ];
            console.log('Created Attendance worksheet');
        }

        await workbook.xlsx.writeFile(EXCEL_FILE);
        console.log('Excel file initialized successfully');
    } catch (error) {
        console.error('Error initializing Excel file:', error);
        throw error;
    }
}

async function getUsers() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE);
    const worksheet = workbook.getWorksheet('Users');
    const users = [];
    
    if (worksheet.rowCount > 1) {
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            users.push({
                username: row.getCell(1).value,
                email: row.getCell(2).value,
                password: row.getCell(3).value,
                registeredAt: row.getCell(4).value,
                role: row.getCell(5).value
            });
        }
    }
    
    return users;
}

async function saveUser(user) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE);
    const worksheet = workbook.getWorksheet('Users');
    
    const newRow = worksheet.addRow([
        user.username,
        user.email,
        user.password,
        user.registeredAt,
        user.role
    ]);
    
    await workbook.xlsx.writeFile(EXCEL_FILE);
}

app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        const users = await getUsers();
        if (users.some(user => user.username === username)) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        const newUser = {
            username,
            email,
            password,
            registeredAt: new Date().toISOString(),
            role: 'user'
        };
        
        await saveUser(newUser);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error in registration:', error);
        res.status(500).json({ error: 'Error registering user' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const users = await getUsers();
        const user = users.find(u => u.username === username);
        
        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        const role = user.role || 'user';
        console.log(`User ${username} logged in with role: ${role}`);
        
        res.json({
            username: user.username,
            email: user.email,
            role: role
        });
    } catch (error) {
        console.error('Error in login:', error);
        res.status(500).json({ error: 'Error logging in' });
    }
});

app.post('/change-password', async (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    console.log('Password change request received:', { username });

    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(EXCEL_FILE);
        const worksheet = workbook.getWorksheet('Users');

        let userRow = null;
        let rowNumber = 0;
        
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            const rowUsername = row.getCell(1).value;
            if (rowUsername === username) {
                userRow = row;
                rowNumber = i;
                break;
            }
        }

        if (!userRow) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const storedPassword = userRow.getCell(3).value;
        if (storedPassword !== currentPassword) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }

        const row = worksheet.getRow(rowNumber);
        row.getCell(3).value = newPassword;
        
        await workbook.xlsx.writeFile(EXCEL_FILE);
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error in password change:', error);
        res.status(500).json({ success: false, message: 'Error changing password: ' + error.message });
    }
});

async function saveProfile(profile) {
    const workbook = new ExcelJS.Workbook();
    try {
        if (!fs.existsSync(EXCEL_FILE)) {
            await initializeExcel();
        }

        await workbook.xlsx.readFile(EXCEL_FILE);
        const worksheet = workbook.getWorksheet('Profiles');
        
        if (!worksheet) {
            throw new Error('Profiles worksheet not found');
        }

        let existingRow = null;
        let rowNumber = 0;
        
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            if (row.getCell(1).value === profile.username) {
                existingRow = row;
                rowNumber = i;
                break;
            }
        }
        
        if (existingRow) {
            const row = worksheet.getRow(rowNumber);
            row.getCell(2).value = profile.fullName || '';
            row.getCell(3).value = profile.email || '';
            row.getCell(4).value = profile.phone || '';
            row.getCell(5).value = profile.address || '';
            row.getCell(6).value = profile.city || '';
            row.getCell(7).value = profile.state || '';
            row.getCell(8).value = profile.country || '';
            row.getCell(9).value = profile.zipCode || '';
            row.getCell(10).value = new Date().toISOString();
        } else {
            worksheet.addRow([
                profile.username,
                profile.fullName || '',
                profile.email || '',
                profile.phone || '',
                profile.address || '',
                profile.city || '',
                profile.state || '',
                profile.country || '',
                profile.zipCode || '',
                new Date().toISOString()
            ]);
        }
        
        await workbook.xlsx.writeFile(EXCEL_FILE);
        return true;
    } catch (error) {
        console.error('Error in saveProfile:', error);
        throw new Error('Failed to save profile: ' + error.message);
    }
}

async function getProfile(username) {
    const workbook = new ExcelJS.Workbook();
    try {
        if (!fs.existsSync(EXCEL_FILE)) {
            await initializeExcel();
            return null;
        }

        await workbook.xlsx.readFile(EXCEL_FILE);
        const worksheet = workbook.getWorksheet('Profiles');
        
        if (!worksheet) {
            throw new Error('Profiles worksheet not found');
        }

        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            if (row.getCell(1).value === username) {
                return {
                    username: row.getCell(1).value,
                    fullName: row.getCell(2).value,
                    email: row.getCell(3).value,
                    phone: row.getCell(4).value,
                    address: row.getCell(5).value,
                    city: row.getCell(6).value,
                    state: row.getCell(7).value,
                    country: row.getCell(8).value,
                    zipCode: row.getCell(9).value,
                    lastUpdated: row.getCell(10).value
                };
            }
        }
        return null;
    } catch (error) {
        console.error('Error in getProfile:', error);
        throw new Error('Failed to get profile: ' + error.message);
    }
}

app.get('/profile/:username', async (req, res) => {
    try {
        const profile = await getProfile(req.params.username);
        if (profile) {
            res.json({ success: true, profile });
        } else {
            res.json({ 
                success: true, 
                profile: {
                    username: req.params.username,
                    fullName: '',
                    email: '',
                    phone: '',
                    address: '',
                    city: '',
                    state: '',
                    country: '',
                    zipCode: ''
                }
            });
        }
    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/save-profile', async (req, res) => {
    try {
        const profile = req.body;
        if (!profile.username) {
            return res.status(400).json({ success: false, message: 'Username is required' });
        }

        await saveProfile(profile);
        res.json({ success: true, message: 'Profile saved successfully' });
    } catch (error) {
        console.error('Error saving profile:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

async function deleteAccount(username, password) {
    const workbook = new ExcelJS.Workbook();
    try {
        if (!fs.existsSync(EXCEL_FILE)) {
            console.error('Database file not found at:', EXCEL_FILE);
            throw new Error('Database file not found');
        }

        try {
            await workbook.xlsx.readFile(EXCEL_FILE);
        } catch (readError) {
            console.error('Error reading Excel file:', readError);
            throw new Error('Error reading database file');
        }

        const usersWorksheet = workbook.getWorksheet('Users');
        const profilesWorksheet = workbook.getWorksheet('Profiles');
        
        if (!usersWorksheet) {
            console.error('Users worksheet not found');
            throw new Error('Users worksheet not found');
        }
        if (!profilesWorksheet) {
            console.error('Profiles worksheet not found');
            throw new Error('Profiles worksheet not found');
        }

        let userFound = false;
        let correctPassword = false;
        let userRowIndex = -1;

        for (let i = 2; i <= usersWorksheet.rowCount; i++) {
            const row = usersWorksheet.getRow(i);
            const rowUsername = row.getCell(1).value;
            const rowPassword = row.getCell(3).value;
            
            if (rowUsername === username) {
                userFound = true;
                userRowIndex = i;
                if (rowPassword === password) {
                    correctPassword = true;
                    break;
                }
            }
        }

        if (!userFound) {
            console.error('User not found:', username);
            throw new Error('User not found');
        }

        if (!correctPassword) {
            console.error('Incorrect password for user:', username);
            throw new Error('Incorrect password');
        }

        if (userRowIndex > 0) {
            usersWorksheet.spliceRows(userRowIndex, 1);
            console.log('Deleted user from Users worksheet:', username);
        }

        for (let i = 2; i <= profilesWorksheet.rowCount; i++) {
            const row = profilesWorksheet.getRow(i);
            if (row.getCell(1).value === username) {
                profilesWorksheet.spliceRows(i, 1);
                console.log('Deleted user from Profiles worksheet:', username);
                break;
            }
        }

        try {
            await workbook.xlsx.writeFile(EXCEL_FILE);
            console.log('Successfully deleted account:', username);
            return true;
        } catch (writeError) {
            console.error('Error writing to Excel file:', writeError);
            throw new Error('Error saving changes to database');
        }
    } catch (error) {
        console.error('Error in deleteAccount function:', error);
        throw error;
    }
}

app.post('/delete-account', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    try {
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Invalid request body'
            });
        }

        const { username, password } = req.body;
        console.log('Delete account request received for user:', username);

        if (!username || !password) {
            console.error('Missing username or password in delete request');
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password are required' 
            });
        }

        const result = await deleteAccount(username, password);
        if (result) {
            return res.json({ 
                success: true, 
                message: 'Account deleted successfully' 
            });
        } else {
            throw new Error('Failed to delete account');
        }
    } catch (error) {
        console.error('Error in delete-account endpoint:', error);
        return res.status(500).json({ 
            success: false, 
            message: error.message || 'An error occurred while deleting the account' 
        });
    }
});

const isAdmin = async (req, res, next) => {
    try {
        const username = req.body.username;
        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(EXCEL_FILE);
        const worksheet = workbook.getWorksheet('Users');
        
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            if (row.getCell(1).value === username && row.getCell(5).value === 'admin') {
                return next();
            }
        }
        res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    } catch (error) {
        console.error('Error checking admin status:', error);
        res.status(500).json({ error: 'Error checking admin status' });
    }
};

app.post('/api/admin/users', isAdmin, async (req, res) => {
    try {
        const users = await getUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching users' });
    }
});

app.post('/api/admin/edit-user', isAdmin, async (req, res) => {
    try {
        const { targetUsername, updates } = req.body;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(EXCEL_FILE);
        const worksheet = workbook.getWorksheet('Users');
        
        let userRow = null;
        let rowNumber = 0;
        
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            if (row.getCell(1).value === targetUsername) {
                userRow = row;
                rowNumber = i;
                break;
            }
        }

        if (!userRow) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (updates.email) userRow.getCell(2).value = updates.email;
        if (updates.password) userRow.getCell(3).value = updates.password;
        if (updates.role) userRow.getCell(5).value = updates.role;

        await workbook.xlsx.writeFile(EXCEL_FILE);
        res.json({ message: 'User updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error updating user' });
    }
});

app.post('/api/admin/delete-user', isAdmin, async (req, res) => {
    try {
        const { targetUsername } = req.body;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(EXCEL_FILE);
        const worksheet = workbook.getWorksheet('Users');
        
        let rowNumber = 0;
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            if (row.getCell(1).value === targetUsername) {
                rowNumber = i;
                break;
            }
        }

        if (rowNumber > 0) {
            worksheet.spliceRows(rowNumber, 1);
            await workbook.xlsx.writeFile(EXCEL_FILE);
            res.json({ message: 'User deleted successfully' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error deleting user' });
    }
});

app.post('/api/admin/create-user', isAdmin, async (req, res) => {
    try {
        console.log('Received create user request:', req.body);
        const { newUser } = req.body;
        
        if (!newUser) {
            console.log('No newUser data provided');
            return res.status(400).json({ error: 'New user data is required' });
        }
        
        const { username, email, password, role } = newUser;
        
        if (!username || !email || !password) {
            console.log('Missing required fields:', { username, email, password });
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }
        
        console.log('Creating user with data:', { username, email, role });
        
        const users = await getUsers();
        if (users.some(user => user.username === username)) {
            console.log('Username already exists:', username);
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        const user = {
            username,
            email,
            password,
            registeredAt: new Date().toISOString(),
            role: role || 'user'
        };
        
        console.log('Saving new user:', user);
        await saveUser(user);
        console.log('User saved successfully');
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Error in admin user creation:', error);
        res.status(500).json({ error: 'Error creating user: ' + error.message });
    }
});

app.post('/api/admin/get-attendance', isAdmin, async (req, res) => {
    try {
        const { username, user, month, date } = req.body;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(EXCEL_FILE);
        const worksheet = workbook.getWorksheet('Attendance');
        if (!worksheet) {
            throw new Error('Attendance worksheet not found');
        }
        const records = [];
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            const recordUser = row.getCell(1).value;
            let recordDate = row.getCell(2).value;
            if (recordDate instanceof Date) {
                const yyyy = recordDate.getFullYear();
                const mm = String(recordDate.getMonth() + 1).padStart(2, '0');
                const dd = String(recordDate.getDate()).padStart(2, '0');
                recordDate = `${yyyy}-${mm}-${dd}`;
            } else if (typeof recordDate === 'number') {
                const excelEpoch = new Date(1899, 11, 30);
                const jsDate = new Date(excelEpoch.getTime() + (recordDate * 24 * 60 * 60 * 1000));
                const yyyy = jsDate.getFullYear();
                const mm = String(jsDate.getMonth() + 1).padStart(2, '0');
                const dd = String(jsDate.getDate()).padStart(2, '0');
                recordDate = `${yyyy}-${mm}-${dd}`;
            } else if (typeof recordDate === 'string' && recordDate.length >= 10) {
                recordDate = recordDate.substring(0, 10);
            }
            if (user && recordUser !== user) continue;
            if (date) {
                if (recordDate !== date) continue;
            } else if (month) {
                if (!recordDate.startsWith(month)) continue;
            }
            records.push({
                username: recordUser,
                date: recordDate,
                status: row.getCell(3).value,
                remarks: row.getCell(4).value,
                markedBy: row.getCell(5).value,
                markedAt: row.getCell(6).value
            });
        }
        res.json(records);
    } catch (error) {
        res.status(500).json({ error: 'Error getting attendance: ' + error.message });
    }
});

app.post('/api/admin/mark-attendance', isAdmin, async (req, res) => {
    try {
        const { username, user, month, attendanceData } = req.body;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(EXCEL_FILE);
        const worksheet = workbook.getWorksheet('Attendance');
        if (!worksheet) {
            throw new Error('Attendance worksheet not found');
        }
        for (const record of attendanceData) {
            const { date, status, remarks } = record;
            if (!user || !date || !status) continue;
            let existingRow = null;
            let rowNumber = 0;
            for (let i = 2; i <= worksheet.rowCount; i++) {
                const row = worksheet.getRow(i);
                if (row.getCell(1).value === user && row.getCell(2).value === date) {
                    existingRow = row;
                    rowNumber = i;
                    break;
                }
            }
            if (existingRow) {
                const row = worksheet.getRow(rowNumber);
                row.getCell(3).value = status;
                row.getCell(4).value = remarks || '';
                row.getCell(5).value = username;
                row.getCell(6).value = new Date().toISOString();
            } else {
                worksheet.addRow([
                    user,
                    date,
                    status,
                    remarks || '',
                    username,
                    new Date().toISOString()
                ]);
            }
        }
        await workbook.xlsx.writeFile(EXCEL_FILE);
        res.json({ message: 'Attendance saved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error saving attendance: ' + error.message });
    }
});

app.get('/:page', (req, res) => {
    const page = req.params.page;
    res.sendFile(path.join(__dirname, 'public', page));
});

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    if (err.code === 'ENOENT' && err.path && err.path.endsWith('favicon.ico')) {
        return res.status(204).end();
    }
    if (err.code === 'ENOENT') {
        res.status(404).json({ error: 'Resource not found' });
    } else {
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function ensureRegisteredAtForAllUsers() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE);
    const worksheet = workbook.getWorksheet('Users');
    let updated = false;
    for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        if (!row.getCell(4).value) {
            row.getCell(4).value = new Date().toISOString();
            updated = true;
        }
    }
    if (updated) {
        await workbook.xlsx.writeFile(EXCEL_FILE);
        console.log('Filled missing registeredAt fields for users.');
    }
}
    
ensureRegisteredAtForAllUsers();

initializeExcel()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
            console.log('Press Ctrl+C to stop the server');
        });
    })
    .catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    }); 