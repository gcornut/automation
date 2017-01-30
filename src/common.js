import fs from 'fs'
import yaml from 'js-yaml'
import childProcess from 'child_process'
import path from 'path'
import tildeExpansion from 'tilde-expansion'

let dryRun = false

export let fail = err => { throw new Error(err) }

// Transforms node-style callback demanding functions into promise returning functions
export function promisify(fn) {
  return (...args) => new Promise((resolve, reject) => {
    fn(...args.concat([(err, val) => err ? reject(err) : resolve(val)]))
  })
}
let readFile = promisify(fs.readFile)

// Resolve/join path and expand tilde character to the user directory
export function pathResolve(...parts) {
  return new Promise((resolve, _) => {
    let joined = path.join(...parts)
    tildeExpansion(joined, resolve)
  }).then(path.resolve)
}

// Create stdout and stderr loggers with a string transformation function
export function createLoggers(fn) {
  let fnLines = m => m.toString().trimRight().split('\n').map(fn).join('\n')
  let logOut = (m, ...ms) => console.log(fnLines(m), ...ms)
  let logErr = (m, ...ms) => console.error(fnLines(m), ...ms)
  return { logOut, logErr }
}

// Read a yaml config file at the root of the project
export async function getConfig(name = 'common.yaml') {
  if(!name.endsWith('.yaml')) name += '.yaml'
  let content = await readFile(await pathResolve(__dirname, '..', name))
  return yaml.safeLoad(content.toString())
}

const curry = fn => function curry_inner(...args) {
  if (args.length >= fn.length)
    return fn(...args)
  else
    return (...args2) => curry_inner(...args.concat(args2))
}

export const is = type => value => value && value.constructor === type
export const isArray = is(Array)
export const isArrayOf = type => value => isArray(value) && value.every(is(type))
export const isPromise = is(Promise)
export const isArrayOfPromise = isArrayOf(Promise)

// Executes a callback with a timer and error handling
export async function timer(name, callback) {
  let started = new Date()
  let {logOut, logErr} = createLoggers(l => '[' + name + '] ' + l)
  logOut('Started', started)

  let exitCode, errors = []
  let catchAddError = error => errors.push(error)

  let r = callback(), p, a
  while ((p = isPromise(r)) || (a = isArrayOfPromise(r))) {
    if (p)
      r = await r.catch(catchAddError)
    else if(a)
      r = await Promise.all(r.map(r => r.catch(catchAddError)))
  }

  if (errors.length) {
    errors.map(logErr)
    exitCode = 1
  }

  let finished = new Date()
  logOut('Finished', finished)
  let elapsed = new Date(finished - started)
  let message = ['Elapsed time:']
  if (elapsed.getHours() - 1 > 0)
    message.push(elapsed.getHours() - 1, 'hour' + (elapsed.getHours() > 2 ? 's' : ''))
  if (elapsed.getMinutes())
    message.push(elapsed.getMinutes(), 'minute' + (elapsed.getMinutes() > 1 ? 's' : ''))
  message.push(elapsed.getSeconds(), 'second' + (elapsed.getSeconds() > 1 ? 's' : ''))
  logOut(...message)
  console.log()

  process.exit(exitCode ? exitCode : 0)
}

// Asynchronously spawn a program with args and other options
export function spawn(
  program, args, { env, logOut = console.log, logErr = console.error }
) {
  logOut(program + ' ' + args.join(' '))
  if (dryRun) return

  let process = childProcess.spawn(program, args, { env })
  process.stdout.on('data', c => logOut(c.toString()))
  process.stderr.on('data', c => logErr(c.toString()))
  return new Promise((resolve, reject) => {
    process.on('close', code => {
      logOut(program, 'finished')
      if (code === 0) resolve(code)
      else reject(code)
    })
  })
}
