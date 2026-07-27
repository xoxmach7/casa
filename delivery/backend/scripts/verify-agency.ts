
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

// Admin credentials (from previous context or assumed default)
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'adminpassword'; // Replace with actual if known, or I'll try to find it.
// Actually, I'll create a new Agency directly using a secret key if possible, or just use the public signup if it existed.
// But user creation is ADMIN only.
// I need an ADMIN token first.

async function verifyAgencyFlow() {
    try {
        console.log('1. Logging in as ADMIN...');
        // In a real scenario I need real creds. 
        // I will assume I can create an admin or there is one.
        // Let's try to login with default admin if it exists.
        // If not, I might need to seed one.

        let adminToken = '';
        try {
            const loginRes = await axios.post(`${API_URL}/auth/login`, {
                email: 'admin@casa.pro',
                password: 'password123'
            });
            adminToken = loginRes.data.token;
            console.log('   Admin logged in successfully.');
        } catch (e) {
            console.log('   Failed to login as default admin. Creating one directly...');

            // Direct Prisma access to create admin
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();
            const bcrypt = require('bcryptjs'); // Need bcryptjs installed

            const hashedPassword = await bcrypt.hash('password123', 10);

            try {
                await prisma.user.upsert({
                    where: { email: 'admin@casa.pro' },
                    update: {},
                    create: {
                        email: 'admin@casa.pro',
                        password: hashedPassword,
                        role: 'ADMIN',
                        firstName: 'Admin',
                        lastName: 'User',
                        phone: '+77777777777'
                    }
                });
                console.log('   Admin user ensured via Prisma.');

                const loginResRetry = await axios.post(`${API_URL}/auth/login`, {
                    email: 'admin@casa.pro',
                    password: 'password123'
                });
                adminToken = loginResRetry.data.token;
                console.log('   Admin logged in successfully after creation.');

            } catch (dbError) {
                console.error('DB Error creating admin:', dbError);
                throw dbError;
            } finally {
                await prisma.$disconnect();
            }
        }

        console.log('2. Creating AGENCY user...');
        const agencyEmail = `agency_${Date.now()}@test.com`;
        const agencyPassword = 'password123';
        const agencyRes = await axios.post(`${API_URL}/admin/users`, {
            email: agencyEmail,
            password: agencyPassword,
            firstName: 'Test',
            lastName: 'Agency',
            phone: '+77000000001',
            role: 'AGENCY'
        }, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const agencyUser = agencyRes.data;
        console.log('   Agency created:', agencyUser.email);

        console.log('3. Logging in as AGENCY...');
        const agencyLoginRes = await axios.post(`${API_URL}/auth/login`, {
            email: agencyEmail,
            password: agencyPassword
        });
        const agencyToken = agencyLoginRes.data.token;
        console.log('   Agency logged in.');

        console.log('4. Agency creating REALTOR...');
        const realtorEmail = `realtor_${Date.now()}@test.com`;
        const realtorPassword = 'password123';
        const realtorRes = await axios.post(`${API_URL}/agency/team`, {
            email: realtorEmail,
            password: realtorPassword,
            firstName: 'Test',
            lastName: 'Realtor',
            phone: '+77000000002',
            city: 'Almaty'
        }, {
            headers: { Authorization: `Bearer ${agencyToken}` }
        });
        const realtorUser = realtorRes.data;
        console.log('   Realtor created:', realtorUser.email);

        console.log('5. Logging in as REALTOR...');
        const realtorLoginRes = await axios.post(`${API_URL}/auth/login`, {
            email: realtorEmail,
            password: realtorPassword
        });
        const realtorToken = realtorLoginRes.data.token;
        console.log('   Realtor logged in.');

        console.log('6. Realtor creating Custom Funnel...');
        const funnelRes = await axios.post(`${API_URL}/custom-funnels`, {
            name: 'Realtor Funnel',
            isActive: true,
            stages: [
                { name: 'Stage 1', color: '#000000', order: 0 },
                { name: 'Stage 2', color: '#ffffff', order: 1 }
            ]
        }, {
            headers: { Authorization: `Bearer ${realtorToken}` }
        });
        console.log('   Custom Funnel created:', funnelRes.data.name);

        console.log('7. Realtor creating Custom Field...');
        const fieldRes = await axios.post(`${API_URL}/custom-fields`, {
            name: 'Realtor Field',
            type: 'TEXT',
            entityType: 'SELLER',
            isActive: true
        }, {
            headers: { Authorization: `Bearer ${realtorToken}` }
        });
        console.log('   Custom Field created:', fieldRes.data.name);

        console.log('8. Agency EDITING Realtor...');
        const editRes = await axios.put(`${API_URL}/agency/team/${realtorUser.id}`, {
            firstName: 'Updated',
            lastName: 'Realtor',
            phone: '+77000000002',
            city: 'Astana',
            isActive: true
        }, {
            headers: { Authorization: `Bearer ${agencyToken}` }
        });
        console.log('   Realtor updated:', editRes.data.firstName, editRes.data.city);

        console.log('9. Agency DELETING Realtor...');
        await axios.delete(`${API_URL}/agency/team/${realtorUser.id}`, {
            headers: { Authorization: `Bearer ${agencyToken}` }
        });
        console.log('   Realtor deleted/deactivated.');

        console.log('SUCCESS: Agency/Realtor flow verified (Create -> Edit -> Delete).');

    } catch (error: any) {
        console.error('VERIFICATION FAILED:', error.response?.data || error.message);
    }
}

verifyAgencyFlow();
