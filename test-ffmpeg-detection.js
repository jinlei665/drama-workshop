/**
 * FFmpeg 检测测试脚本
 * 运行: node test-ffmpeg-detection.js
 */

const { exec } = require('child_process');
const promisify = require('util').promisify;
const execAsync = promisify(exec);

async function testFfmpegDetection() {
  console.log('=== FFmpeg 检测测试 ===\n');

  // 1. 测试 where ffmpeg
  console.log('1. 测试 where ffmpeg:');
  try {
    const { stdout } = await execAsync('where ffmpeg', { timeout: 3000 });
    console.log('   输出:', stdout.trim());
    console.log('   状态: 找到\n');
  } catch (err) {
    console.log('   错误:', err.message);
    console.log('   状态: 未找到\n');
  }

  // 2. 测试直接执行 ffmpeg
  console.log('2. 测试直接执行 ffmpeg -version:');
  try {
    const { stdout } = await execAsync('ffmpeg -version', { timeout: 5000, windowsHide: true });
    const firstLine = stdout.split('\n')[0];
    console.log('   输出:', firstLine);
    console.log('   状态: 可用\n');
  } catch (err) {
    console.log('   错误:', err.message);
    console.log('   状态: 不可用\n');
  }

  // 3. 测试 Windows 常见路径
  console.log('3. 测试 Windows 常见安装路径:');
  const commonPaths = [
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    process.env.LOCALAPPDATA + '\\ffmpeg\\bin\\ffmpeg.exe',
  ].filter(Boolean);

  for (const ffmpegPath of commonPaths) {
    try {
      await execAsync(`"${ffmpegPath}" -version`, { timeout: 5000 });
      console.log(`   ${ffmpegPath}: 可用`);
    } catch {
      console.log(`   ${ffmpegPath}: 不可用`);
    }
  }

  // 4. 检查 PATH 环境变量
  console.log('\n4. PATH 环境变量中的 ffmpeg 相关路径:');
  const pathDirs = process.env.PATH ? process.env.PATH.split(';') : [];
  const ffmpegDirs = pathDirs.filter(p => p.toLowerCase().includes('ffmpeg'));
  if (ffmpegDirs.length > 0) {
    ffmpegDirs.forEach(p => console.log('   ', p));
  } else {
    console.log('   (无)');
  }
}

testFfmpegDetection().catch(console.error);
