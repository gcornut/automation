import fs from 'fs'
import yaml from 'js-yaml'
import childProcess from 'child-process-promise'
import path from 'path'
import tildeExpansion from 'tilde-expansion'
import promisify from 'promisify-es6'

let readFile = promisify(fs.readFile)
let tildExpand = path => new Promise((resolve, _) => tildeExpansion(path, resolve))

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

const is = type => value => value && value.constructor === type
const isArray = is(Array)
const isArrayOf = type => value => isArray(value) && value.every(is(type))
const isPromise = is(Promise), isArrayOfPromise = isArrayOf(Promise)

// Executes a callback with a timer and error handling
export async function timer(name, callback) {
  let started = new Date()
  let {logOut, logErr} = createLoggers(l => '[' + name + '] ' + l)
  logOut('Started', started)

  let exitCode, errors = []
  let catchAddError = error => errors.push(error)

  let r = callback()
  while (isPromise(r) || isArrayOfPromise(r)) {
    if (isPromise(r))
      r = await r.catch(catchAddError)
    else if(isArrayOfPromise(r))
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
export async function spawn(program, args, {env, logOut = console.log, logErr = console.error}) {
  logOut(program + ' ' + args.join(' '))
  let promise = childProcess.spawn(program, args, { env })
  promise.childProcess.stdout.on('data', c => logOut(c.toString()))
  promise.childProcess.stderr.on('data', logErr)
  return promise.then(() => logOut(program, 'finished'))
}

// Resolve/join path and expand tilde character to the user directory
export async function pathResolve(...parts) {
  return path.resolve(await tildExpand(path.join(...parts)))
}
