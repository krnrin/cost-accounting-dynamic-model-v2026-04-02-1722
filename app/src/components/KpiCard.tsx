import { Typography } from '@douyinfe/semi-ui';
const { Text } = Typography;

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  prefix?: string;
  color?: string;
  onClick?: () => void;
}

export default function KpiCard({ label, value, unit, prefix, color, onClick }: KpiCardProps) {
  const displayValue = typeof value === 'number' 
    ? (prefix || '') + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (unit || '')
    : (prefix || '') + value + (unit || '');
  
  return (
    <div 
      className="kpi-card glass-card smooth-transition" 
      style={{ 
        padding: '20px', 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <Text style={{ 
        color: 'var(--text-secondary)', 
        fontSize: 12, 
        fontWeight: 600, 
        textTransform: 'uppercase', 
        letterSpacing: '0.5px' 
      }}>
        {label}
      </Text>
      <div className="consolas-font" style={{ 
        fontSize: '28px', 
        fontWeight: 700, 
        color: color || 'var(--text-primary)', 
        marginTop: '12px',
        lineHeight: 1,
      }}>
        {displayValue}
      </div>
    </div>
  );
}
