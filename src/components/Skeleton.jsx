import React from 'react';

const shimmer = {
  background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 37%, #f0f0f0 63%)',
  backgroundSize: '400% 100%',
  animation: 'skeleton-shimmer 1.4s ease infinite',
  borderRadius: 8,
};

export const SkeletonBox = ({ w = '100%', h = 16, r = 8, style = {} }) => (
  <div style={{ width: w, height: h, borderRadius: r, ...shimmer, ...style }} />
);

export const SkeletonCard = () => (
  <div style={{
    background: 'white', borderRadius: 16,
    border: '1px solid #e5e7eb', padding: 24,
    display: 'flex', flexDirection: 'column', gap: 12,
  }}>
    <SkeletonBox h={12} w="40%" />
    <SkeletonBox h={40} w="60%" />
    <SkeletonBox h={10} w="50%" />
  </div>
);

export const SkeletonTableRow = () => (
  <tr>
    <td style={{ padding: '13px 16px', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, ...shimmer }} />
        <SkeletonBox h={13} w={120} />
      </div>
    </td>
    <td style={{ padding: '13px 16px', borderBottom: '1px solid #f3f4f6' }}><SkeletonBox h={13} w={90} /></td>
    <td style={{ padding: '13px 16px', borderBottom: '1px solid #f3f4f6' }}><SkeletonBox h={13} w={100} /></td>
    <td style={{ padding: '13px 16px', borderBottom: '1px solid #f3f4f6' }}><SkeletonBox h={13} w={80} /></td>
    <td style={{ padding: '13px 16px', borderBottom: '1px solid #f3f4f6' }}><SkeletonBox h={22} w={60} r={20} /></td>
  </tr>
);

export const SkeletonMetricCards = () => (
  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
    {[1, 2].map(i => (
      <div key={i} style={{ flex: '1 1 160px', background: '#f9fafb', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 24px' }}>
        <SkeletonBox h={10} w="50%" style={{ marginBottom: 12 }} />
        <SkeletonBox h={40} w="40%" style={{ marginBottom: 10 }} />
        <SkeletonBox h={10} w="60%" />
      </div>
    ))}
    <div style={{ flex: '2 1 300px', background: '#f9fafb', borderRadius: 14, border: '1px solid #e5e7eb', padding: '16px 20px' }}>
      <SkeletonBox h={12} w="30%" style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100, paddingTop: 10 }}>
        {[60, 90, 45, 80, 55, 70].map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, ...shimmer, borderRadius: 4 }} />
        ))}
      </div>
    </div>
  </div>
);

export const SkeletonCourseCards = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 20 }}>
    {[1, 2, 3].map(i => (
      <div key={i} style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ height: 5, ...shimmer, borderRadius: 0 }} />
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, ...shimmer }} />
          <SkeletonBox h={18} w="50%" />
          <SkeletonBox h={13} w="80%" />
          <div style={{ paddingTop: 16, borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
            <SkeletonBox h={24} w={80} r={20} />
            <SkeletonBox h={14} w={80} />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// Global shimmer keyframes — injected once
const styleTag = document.createElement('style');
styleTag.textContent = `@keyframes skeleton-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`;
if (!document.head.querySelector('#skeleton-style')) {
  styleTag.id = 'skeleton-style';
  document.head.appendChild(styleTag);
}
