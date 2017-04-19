import {timer, createLoggers, spawn, promisify,
        pathResolve, getConfig, fail, isArray} from './common'
import parseFileSize from 'filesize-parser'

let getSize = promisify(require('get-folder-size'))
let configName = process.argv[2].replace('.yaml', '')

timer('synchronize', async () => {
  let {rclonePath} = await getConfig()
  let {repository, synchronize} = await getConfig(configName)
  let repositoryPath = await pathResolve(repository)
  if (!isArray(synchronize)) synchronize = [synchronize]

  return synchronize.map(async ({path, sizeLimit}) => {
    let matches = path.match(/(\w+?):\/\/((.*?):(.*))/)
    if (matches.length !== 5)
      fail('Unrecognized destination ' + path)
    let [_, scheme, dest, destHost, destPath] = matches

    if (destPath.trim() === '')
      fail('Destination folder should\'nt be blank')

    // check source size against limit
    if (sizeLimit) {
      let srcSize = await getSize(repositoryPath)
      let destSizeLimit = parseFileSize(sizeLimit) * 10
      if (srcSize > destSizeLimit)
        fail('Source folder ' + repositoryPath + ' is bigger than size limit ' + sizeLimit)
    }

    // Prepare rclone or rsync
    let program, args = []
    if (scheme === 'rclone') {
      program = await pathResolve(rclonePath)
      args.push('sync', '--delete-after')
    } else if (scheme === 'rsync') {
      program = 'rsync'
      args.push('-aL', '--safe-links', '--progress', '--delete-after')
      repositoryPath += '/'
    } else fail('Unrecognized scheme ' + scheme)
    args.push(repositoryPath, dest)

    let {logOut, logErr} = createLoggers(l =>
      '[synchronize:' + configName + '->' + destHost + '] ' + l
    )
    await spawn(program, args, {logOut, logErr})
  })
})
