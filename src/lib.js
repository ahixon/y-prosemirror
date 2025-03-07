import { ProsemirrorMapping } from './plugins/sync-plugin.js' // eslint-disable-line

import * as Y from 'yjs'
import * as error from 'lib0/error.js'

/**
 * Transforms a Prosemirror based absolute position to a Yjs Cursor (relative position in the Yjs model).
 *
 * @param {number} pos
 * @param {Y.XmlFragment} type
 * @param {ProsemirrorMapping} mapping
 * @return {any} relative position
 */
export const absolutePositionToRelativePosition = (pos, type, mapping) => {
  if (pos === 0) {
    return Y.createRelativePositionFromTypeIndex(type, 0)
  }
  let n = type._first === null ? null : /** @type {Y.ContentType} */ (type._first.content).type
  while (n !== null && type !== n) {
    const pNodeSize = (mapping.get(n) || { nodeSize: 0 }).nodeSize
    if (n.constructor === Y.XmlText) {
      if (n._length >= pos) {
        return Y.createRelativePositionFromTypeIndex(n, pos)
      } else {
        pos -= n._length
      }
      if (n._item !== null && n._item.next !== null) {
        n = /** @type {Y.ContentType} */ (n._item.next.content).type
      } else {
        do {
          n = n._item === null ? null : n._item.parent
          pos--
        } while (n !== type && n !== null && n._item !== null && n._item.next === null)
        if (n !== null && n !== type) {
          // @ts-gnore we know that n.next !== null because of above loop conditition
          n = n._item === null ? null : /** @type {Y.ContentType} */ (/** @type Y.Item */ (n._item.next).content).type
        }
      }
    } else if (n._first !== null && pos < pNodeSize) {
      n = /** @type {Y.ContentType} */ (n._first.content).type
      pos--
    } else {
      if (pos === 1 && n._length === 0 && pNodeSize > 1) {
        // edge case, should end in this paragraph
        return new Y.RelativePosition(n._item === null ? null : n._item.id, n._item === null ? Y.findRootTypeKey(n) : null, null)
      }
      pos -= pNodeSize
      if (n._item !== null && n._item.next !== null) {
        n = /** @type {Y.ContentType} */ (n._item.next.content).type
      } else {
        if (pos === 0) {
          // set to end of n.parent
          n = n._item === null ? n : n._item.parent
          return new Y.RelativePosition(n._item === null ? null : n._item.id, n._item === null ? Y.findRootTypeKey(n) : null, null)
        }
        do {
          n = /** @type {Y.Item} */ (n._item).parent
          pos--
        } while (n !== type && /** @type {Y.Item} */ (n._item).next === null)
        // if n is null at this point, we have an unexpected case
        if (n !== type) {
          // We know that n._item.next is defined because of above loop condition
          n = /** @type {Y.ContentType} */ (/** @type {Y.Item} */ (/** @type {Y.Item} */ (n._item).next).content).type
        }
      }
    }
    if (n === null) {
      throw error.unexpectedCase()
    }
    if (pos === 0 && n.constructor !== Y.XmlText && n !== type) { // TODO: set to <= 0
      return new Y.RelativePosition(n._item === null ? null : n._item.id, n._item === null ? Y.findRootTypeKey(n) : null, null)
    }
  }
  return Y.createRelativePositionFromTypeIndex(type, type._length)
}

/**
 * @param {Y.Doc} y
 * @param {Y.XmlFragment} yDoc Top level type that is bound to pView
 * @param {any} relPos Encoded Yjs based relative position
 * @param {ProsemirrorMapping} mapping
 */
export const relativePositionToAbsolutePosition = (y, yDoc, relPos, mapping) => {
  const decodedPos = Y.createAbsolutePositionFromRelativePosition(relPos, y)
  if (decodedPos === null) {
    return null
  }
  let type = decodedPos.type
  let pos = 0
  if (type.constructor === Y.XmlText) {
    pos = decodedPos.index
  } else if (type._item === null || !type._item.deleted) {
    let n = type._first
    let i = 0
    while (i < type._length && i < decodedPos.index && n !== null) {
      if (!n.deleted) {
        const t = /** @type {Y.ContentType} */ (n.content).type
        i++
        if (t.constructor === Y.XmlText) {
          pos += t._length
        } else {
          pos += mapping.get(t).nodeSize
        }
      }
      n = /** @type {Y.Item} */ (n.right)
    }
    pos += 1 // increase because we go out of n
  }
  while (type !== yDoc) {
    // @ts-ignore
    const parent = type._item.parent
    // @ts-ignore
    if (parent._item === null || !parent._item.deleted) {
      pos += 1 // the start tag
      let n = parent._first
      // now iterate until we found type
      while (n !== null) {
        const contentType = /** @type {Y.ContentType} */ (n.content).type
        if (contentType === type) {
          break
        }
        if (!n.deleted) {
          if (contentType.constructor === Y.XmlText) {
            pos += contentType._length
          } else {
            pos += mapping.get(contentType).nodeSize
          }
        }
        n = n.right
      }
    }
    type = parent
  }
  return pos - 1 // we don't count the most outer tag, because it is a fragment
}
