import { PrismaClient } from '@prisma/client'
import env from './environment'

const client = new PrismaClient({
  datasources: {
    db: {
      url: `file:./storage-${env.name}.sqlite`
    }
  }
})

// Why? To just make sure we're using one instance of PrismaClient for now.
// Not sure if it matters.
export default client

export async function ensureUserExists (id: string, username: string): Promise<void> {
  const user = await client.user.findFirst({ where: { id: BigInt(id) } })
  if (user === null) {
    await client.user.create({ data: { id: BigInt(id), username } })
  }
}
