import { Card, Tag, Typography } from 'antd'
import { PictureOutlined, VideoCameraOutlined } from '@ant-design/icons'
import type { ContentItem } from '../../shared/types'

const { Paragraph } = Typography

interface ContentCardProps {
  item: ContentItem
  onClick?: (item: ContentItem) => void
}

function ContentCard({ item, onClick }: ContentCardProps): JSX.Element {
  return (
    <Card
      hoverable
      size="small"
      onClick={() => onClick?.(item)}
      style={{ marginBottom: 12 }}
      extra={
        <Tag color={item.media_type === 'video' ? 'purple' : 'blue'} icon={item.media_type === 'video' ? <VideoCameraOutlined /> : <PictureOutlined />}>
          {item.media_type}
        </Tag>
      }
      title={item.title}
    >
      <Paragraph ellipsis={{ rows: 2 }}>{item.content}</Paragraph>
      <div>
        {item.tags.map((tag) => (
          <Tag key={tag} style={{ marginBottom: 4 }}>
            {tag}
          </Tag>
        ))}
      </div>
    </Card>
  )
}

export default ContentCard
