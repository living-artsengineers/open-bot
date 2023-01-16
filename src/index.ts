import host from './host'
import './mod/registry'

async function main (): Promise<void> {
  await host.commitStaged()
  await host.start()
}

main().catch(console.error)
