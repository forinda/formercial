import { describe, expect, test } from 'vitest'
import { modelMayLoad } from './model-url'

const page = 'http://127.0.0.1:3000/render/demo'
const model = '/api/v1/projects/demo/file?path=media%2Fcar.glb'
const may = (url: string) => modelMayLoad(url, model, page)

describe('what a model may load', () => {
  test('its own file', () => {
    expect(may(model)).toBe(true)
    expect(may(`http://127.0.0.1:3000${model}`)).toBe(true)
  })

  test('data embedded in the file', () => {
    expect(may('data:application/octet-stream;base64,AAAA')).toBe(true)
    expect(may('blob:http://127.0.0.1:3000/1234')).toBe(true)
  })

  test('nothing on another machine', () => {
    expect(may('https://evil.example/track.png')).toBe(false)
    expect(may('http://169.254.169.254/latest/meta-data/')).toBe(false)
    expect(may('//evil.example/x.bin')).toBe(false)
    expect(may('http://127.0.0.1:9876/x')).toBe(false)
  })

  test('nothing else in the app, or in another project', () => {
    expect(may('/api/v1/projects')).toBe(false)
    expect(may('/api/v1/projects/demo/file?path=project.json')).toBe(false)
    expect(may('/api/v1/projects/demo/file?path=media%2Fother.bin')).toBe(false)
    expect(may('/api/v1/projects/other/file?path=media%2Fcar.glb')).toBe(false)
    expect(may('/api/v1/projects/demo/x.bin')).toBe(false)
  })

  test('nothing that is not a web address', () => {
    expect(may('file:///etc/passwd')).toBe(false)
    expect(may('http://[bad')).toBe(false)
  })
})
