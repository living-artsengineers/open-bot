import { PrismaClient } from '@prisma/client'

// Why? To just make sure we're using one instance of PrismaClient for now.
// Not sure if it matters.
export default new PrismaClient()