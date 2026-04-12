import { Banner, Button } from '@douyinfe/semi-ui';
import { MetalPrices } from '@/types/project';
import { useNavigate } from 'react-router-dom';

interface AlertBannerProps {
  projectId: string;
  currentPrices: MetalPrices;
  basePrices: MetalPrices;
  thresholds: { copperPercent: number; aluminumPercent: number; enabled: boolean };
}

export default function AlertBanner({ projectId, currentPrices, basePrices, thresholds }: AlertBannerProps) {
  const navigate = useNavigate();

  if (!thresholds.enabled) return null;

  const cuDelta = ((currentPrices.copper - basePrices.copper) / basePrices.copper) * 100;
  const alDelta = ((currentPrices.aluminum - basePrices.aluminum) / basePrices.aluminum) * 100;

  const cuExceeded = Math.abs(cuDelta) > thresholds.copperPercent;
  const alExceeded = Math.abs(alDelta) > thresholds.aluminumPercent;

  if (!cuExceeded && !alExceeded) return null;

  let message = '';
  if (cuExceeded && alExceeded) {
    message = `铜价变动 ${cuDelta.toFixed(2)}%, 铝价变动 ${alDelta.toFixed(2)}%, 已超过阈值 (铜:${thresholds.copperPercent}%, 铝:${thresholds.aluminumPercent}%)`;
  } else if (cuExceeded) {
    message = `铜价变动 ${cuDelta.toFixed(2)}%, 已超过阈值 ${thresholds.copperPercent}%`;
  } else {
    message = `铝价变动 ${alDelta.toFixed(2)}%, 已超过阈值 ${thresholds.aluminumPercent}%`;
  }

  return (
    <Banner
      type="warning"
      description={message}
      style={{ marginBottom: 16 }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <Button 
          theme="solid" 
          type="warning" 
          size="small"
          onClick={() => navigate(`/project/${projectId}/annual-drop`)}
        >
          查看影响分析
        </Button>
      </div>
    </Banner>
  );
}
