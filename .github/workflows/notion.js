const axios = require('axios')
const NOTION_PAGE_ID = process.env.NOTION_PAGE_ID
const NOTION_SECRET = process.env.NOTION_SECRET

const notionApiUrl = `https://api.notion.com/v1/blocks/${NOTION_PAGE_ID}/children`
const notionVersion = '2022-06-28'

const headers = {
  'Notion-Version': notionVersion,
  Accept: 'application/json',
  Authorization: `Bearer ${NOTION_SECRET}`,
}

const fetchNotionData = async () => {
  try {
    const res = await axios.get(notionApiUrl, { headers })
    const blocks = res.data.results
    let output = ''

    for (const block of blocks) {
      output += await checkBlock(block)
    }
    return output
  } catch (error) {
    console.error(error)
    throw error // エラーを再スローして呼び出し元でキャッチできるようにする
  }
}

const checkBlock = async (block, indent = 0) => {
  let texts = ' '.repeat(indent)
  if (block.type === 'heading_1') {
    texts += `# ${convertRichText(block.heading_1.rich_text)}\n\n`
  } else if (block.type === 'heading_2') {
    texts += `## ${convertRichText(block.heading_2.rich_text)}\n\n`
  } else if (block.type === 'heading_3') {
    texts += `### ${convertRichText(block.heading_3.rich_text)}\n\n`
  } else if (block.type === 'bulleted_list_item') {
    texts += `- ${convertRichText(block.bulleted_list_item.rich_text)}\n\n`
  } else if (block.type === 'paragraph') {
    texts += `${convertRichText(block.paragraph.rich_text)}\n\n`
  } else if (block.type === 'link_preview') {
    texts += `[${block.link_preview.url}](${block.link_preview.url})\n\n`
  } else {
    texts += '\n\n'
  }

  // 子ブロックがある場合、再帰的に取得。取得するまで待つ
  if (block.has_children) {
    const parentId = block.id
    const childrenUrl = `https://api.notion.com/v1/blocks/${parentId}/children`
    await axios
      .get(childrenUrl, { headers })
      .then(async (res) => {
        const childrenBlocks = res.data.results
        for (const childBlock of childrenBlocks) {
          texts += await checkBlock(childBlock, indent + 2)
        }
      })
      .catch((error) => {
        console.error(error)
      })
  }

  return texts
}

const convertRichText = (richTexts) => {
  let md_texts = ''
  if (richTexts.length === 0) {
    md_texts += '\n'
    return md_texts
  }
  richTexts.forEach((richText) => {
    let md_text = ''
    let endOFNewLine = false
    if (richText.type === 'text') {
      // 文末の改行を削除
      if (richText.text.content.endsWith('\n')) {
        md_text = `${richText.text.content.slice(0, -1)}`
        endOFNewLine = true
      } else {
        md_text = `${richText.text.content}`
      }

      if (richText.text.link !== null) {
        md_text = `[${md_text}](${richText.text.link.url})`
      }

      // アノテーションの処理
      if (richText.annotations.bold) {
        md_text = `**${md_text}**`
      }
      if (richText.annotations.italic) {
        console.log(md_text)
        md_text = `*${md_text}*`
      }
      if (richText.annotations.strikethrough) {
        md_text = `~~${md_text}~~`
      }
      if (richText.annotations.underline) {
        md_text = `<u>${md_text}</u>`
      }
      if (richText.annotations.code) {
        md_text = `\`${md_text}\``
      }
      if (richText.annotations.color !== 'default') {
        md_text = `<span style="color:${richText.annotations.color}">${md_text}</span>`
      }
    }
    if (endOFNewLine) {
      md_text += '\n'
    }
    md_texts += md_text
  })
  return md_texts
}

// 非同期関数を呼び出して結果を取得し、標準出力に出力
fetchNotionData()
  .then((output) => {
    console.log(output)
  })
  .catch((error) => {
    console.error('Error fetching Notion data:', error)
  })
