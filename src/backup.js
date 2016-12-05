import {timer, createLoggers, spawn, promisify,
        pathResolve, getConfig, fail} from './common'
import fs from 'fs'
import os from 'os'

let stat = promisify(fs.stat)
let name = process.argv[2].replace('.yaml', '')

timer('backup', async () => {
  let {borgPath} = await getConfig()
  let {repository, backup} = await getConfig(name)
  let repositoryPath = await pathResolve(repository)
  let {excludes, compression, passphrase, dir, retention} = backup

  // Borg program options
  let program = await pathResolve(borgPath)
  let {logOut, logErr} = createLoggers(l => '[backup:' + name + '] ' + l)
  let options = {
    logOut, logErr,
    env: { BORG_PASSPHRASE: passphrase,
           BORG_RELOCATED_REPO_ACCESS_IS_OK: 'yes' }
  }

  // Check source dir and borg repository exists
  let sourceDir = await pathResolve(dir)
  await Promise.all([stat(repositoryPath), stat(sourceDir)])

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
})
