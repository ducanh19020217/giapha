import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import authRoutes from './authRoutes';
import { authMiddleware } from './authMiddleware';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api', authMiddleware);

// Helper to map Prisma Member to Frontend DetailedMember format
const mapPrismaToDetailedMember = (member: any) => {
  return {
    ...member,
    spouses: [
      ...(member.spouses?.map((s: any) => ({
        id: s.spouseId,
        isPrimary: s.isPrimary,
        order: s.order
      })) || []),
      ...(member.spouseOf?.map((s: any) => ({
        id: s.memberId,
        isPrimary: s.isPrimary,
        order: s.order
      })) || [])
    ]
  };
};

// GET all members
app.get('/api/members', async (req, res) => {
  try {
    const members = await prisma.member.findMany({
      include: {
        spouses: true,
        spouseOf: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    const formattedMembers = members.map(mapPrismaToDetailedMember);
    res.json(formattedMembers);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// POST a new member
app.post('/api/members', async (req, res) => {
  try {
    const data = req.body;
    
    const newMember = await prisma.member.create({
      data: {
        name: data.name,
        gender: data.gender,
        birthDate: data.birthDate || null,
        isDeceased: data.isDeceased || false,
        deathDate: data.deathDate || null,
        generation: data.generation,
        birthOrder: data.birthOrder,
        fatherId: data.fatherId || null,
        motherId: data.motherId || null,
        academicLevel: data.academicLevel || null,
        career: data.career || null,
        biography: data.biography || null,
        avatarUrl: data.avatarUrl || null,
        achievements: data.achievements || []
      },
      include: { spouses: true, spouseOf: true }
    });
    
    res.json(mapPrismaToDetailedMember(newMember));
  } catch (error) {
    console.error('Error creating member:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// POST a spouse
app.post('/api/members/:id/spouses', async (req, res) => {
  const { id } = req.params;
  const { name, isPrimary, order } = req.body;
  
  try {
    // Determine target member to match generation/gender
    const targetMember = await prisma.member.findUnique({ where: { id } });
    if (!targetMember) return res.status(404).json({ error: 'Target member not found' });

    // Create the new spouse member
    const newSpouse = await prisma.member.create({
      data: {
        name,
        gender: targetMember.gender === 'male' ? 'female' : 'male',
        generation: targetMember.generation,
        birthOrder: 1, // Default for spouse
        isDeceased: false
      }
    });

    // Link via SpouseRelation
    await prisma.spouseRelation.create({
      data: {
        memberId: targetMember.id,
        spouseId: newSpouse.id,
        isPrimary,
        order
      }
    });

    // Refetch the new spouse with relationships
    const updatedNewSpouse = await prisma.member.findUnique({
      where: { id: newSpouse.id },
      include: { spouses: true, spouseOf: true }
    });
    
    res.json(mapPrismaToDetailedMember(updatedNewSpouse));
  } catch (error) {
    console.error('Error creating spouse:', error);
    res.status(500).json({ error: 'Failed to create spouse' });
  }
});

// PUT mark deceased
app.put('/api/members/:id/deceased', async (req, res) => {
  const { id } = req.params;
  const { deathDate } = req.body;
  
  try {
    const updatedMember = await prisma.member.update({
      where: { id },
      data: {
        isDeceased: true,
        deathDate
      },
      include: { spouses: true, spouseOf: true }
    });
    
    res.json(mapPrismaToDetailedMember(updatedMember));
  } catch (error) {
    console.error('Error marking deceased:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// PUT update member details
app.put('/api/members/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  
  try {
    const updatedMember = await prisma.member.update({
      where: { id },
      data: {
        name: data.name,
        gender: data.gender,
        birthDate: data.birthDate,
        isDeceased: data.isDeceased,
        deathDate: data.deathDate,
        generation: data.generation,
        birthOrder: data.birthOrder,
        academicLevel: data.academicLevel,
        career: data.career,
        biography: data.biography,
        avatarUrl: data.avatarUrl,
        achievements: data.achievements
      },
      include: { spouses: true, spouseOf: true }
    });
    
    res.json(mapPrismaToDetailedMember(updatedMember));
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
