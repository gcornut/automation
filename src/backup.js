import {timer, createLoggers, spawn, promisify,
        pathResolve, getConfig, fail, isArray} from './common'
import fs from 'fs'
import os from 'os'

let stat = promisify(fs.stat)
let configName = process.argv[2].replace('.yaml', '')

timer('backup', async () => {
  let {borgPath} = await getConfig()
  let {repository, backup} = await getConfig(configName)
  if (!isArray(backup)) backup = [backup]

  // Check borg repository exists
  let repositoryPath = await pathResolve(repository)
  await stat(repositoryPath)

  // Prepare backup processes
  let backups = backup.map(
    ({excludes, compression, passphrase, dir, retention, name}) => {
      return async () => {
        // Borg program options
        let program = await pathResolve(borgPath)
        if (!name) name = configName
        let {logOut, logErr} = createLoggers(l => '[backup:' + name + '] ' + l)
        let options = {
          logOut, logErr,
          env: { BORG_PASSPHRASE: passphrase,
            BORG_RELOCATED_REPO_ACCESS_IS_OK: 'yes' }
        }

        // Check source dir exists
        let sourceDir = await pathResolve(dir)
        await stat(sourceDir)

        let hostname = os.hostname().replace('.local', '')
        let prefix = hostname + '-' + name
        let backupName = repositoryPath + '::' + prefix + '-{now:%Y-%m-%d_%H:%M:%S}'

        // Create backup
        let args = ['create', '-x', '--verbose', '--stats', '--exclude-caches',
        '--compression', compression]
        args.push(backupName, sourceDir)
        args.push(...excludes.reduce((args, exclude) => args.concat(['--exclude', exclude]), []))
        await spawn(program, args, options)

        // Prune backup
        args = ['prune', '-s', '--list', '--verbose',
        '--prefix=' + prefix].concat(retention.split(' '))
        args.push(repositoryPath)
        await spawn(program, args, options)
      }
  })

  // This part must not execute concurrently since the backups share one borg repository
  for(backup of backups) {
    await backup()
  }
})
