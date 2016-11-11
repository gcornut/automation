import {timer, createLoggers, spawn, pathResolve, getConfig} from './common'
import fs from 'fs'
import promisify from 'promisify-es6'

let stat = promisify(fs.stat)
let name = process.argv[2]

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

  // Create backup
  let args = ['create', '-x', '--verbose', '--stats', '--exclude-caches',
	            '--compression', compression]
  args.push(repositoryPath + '::{hostname}-{now:%Y-%m-%d_%H:%M:%S}', sourceDir)
  args.push(...excludes.reduce((args, exclude) => args.concat(['--exclude', exclude]), []))
  await spawn(program, args, options)

  // Prune backup
  args = [ 'prune', '-s', '--list', '--verbose' ].concat(retention.split(' '))
  args.push(repositoryPath)
  await spawn(program, args, options)
})
