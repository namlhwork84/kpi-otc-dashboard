export default function Logo({ width = 150 }) {
  return (
    <img
      src="/ntb-logo.png"
      alt="NTB"
      width={width}
      style={{ display: 'block', height: 'auto', maxWidth: '100%', objectFit: 'contain' }}
    />
  );
}
