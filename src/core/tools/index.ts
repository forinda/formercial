// Every utility. A new one is a defineTool(...) added to this list.
import {
  htmlToPdf,
  htmlToWord,
  mediaConvert,
  officeConvert,
  officeToPdf,
  pdfToWord,
} from './converters'
import {
  pdfCompress,
  pdfMerge,
  pdfSignDigital,
  pdfWorkspaceSign,
  pdfSplit,
  pdfToImages,
  pdfToText,
} from './pdf'
import type { AnyTool } from './tool'

export const TOOLS: AnyTool[] = [
  mediaConvert,
  officeToPdf,
  officeConvert,
  pdfToWord,
  htmlToWord,
  htmlToPdf,
  pdfMerge,
  pdfSplit,
  pdfCompress,
  pdfToImages,
  pdfToText,
  pdfWorkspaceSign,
  pdfSignDigital,
]
