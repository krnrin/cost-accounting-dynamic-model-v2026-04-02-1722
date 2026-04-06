import { Typography } from '@douyinfe/semi-ui';
const { Title, Text } = Typography;

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;  // e.g., '%', 'kg', 'h'
  prefix?: string; // e.g., '¥'
  color?: string;
}

export default function KpiCard({ label, value, unit, prefix, color }: KpiCardProps) {
  const displayValue = typeof value === 'number' 
    ? (prefix || '') + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (unit || '')
    : (prefix || '') + value + (unit || '');
  
  return (
    <div className="kpi-card" style={{ 
      padding: '16px', 
      borderRadius: '8px', 
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      flex: 1
    }}>
      <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Text>
      <div style={{ 
        fontFamily: "'JetBrains Mono', monospace", 
        fontSize: '24px', 
        fontWeight: 600, 
        color: color || '#fff', 
        marginTop: '8px' 
      }}>
        {displayValue}
      </div>
    </div>
  );
}
