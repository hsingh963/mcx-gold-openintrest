using System.Globalization;
using System.IO.Compression;
using System.Net;
using System.Text;
using GoldInrOpenIntrest.Api.Models;

namespace GoldInrOpenIntrest.Api.Services;

public sealed class GraphService
{
    public byte[] BuildGoldOptionChart(IReadOnlyList<OptionData> optionData, string expiry)
    {
        var ordered = optionData.OrderBy(x => x.StrikePrice).ToArray();
        if (ordered.Length == 0)
        {
            throw new ArgumentException("Option data cannot be empty.", nameof(optionData));
        }

        var chart = new PngCanvas(1400, 820);
        chart.Fill(Colors.White);

        chart.DrawTitle("MCX GOLD OPTION CHAIN", expiry);
        chart.DrawLegend();

        const int left = 110;
        const int top = 100;
        const int right = 40;
        const int bottom = 120;
        var plotWidth = chart.Width - left - right;
        var plotHeight = chart.Height - top - bottom;
        var originX = left;
        var originY = top + plotHeight;

        var maxValue = Math.Max(1L, ordered.Max(x => Math.Max(x.CallOI, x.PutOI)));
        var yTicks = 5;
        var tickStep = (double)maxValue / yTicks;

        chart.DrawText(24, 52, "OPEN INTEREST", Colors.DarkSlateGray, scale: 2);
        chart.DrawText(chart.Width / 2 - 85, chart.Height - 56, "STRIKE PRICE", Colors.DarkSlateGray, scale: 2);

        chart.DrawLine(originX, originY, originX + plotWidth, originY, Colors.Black, 2);
        chart.DrawLine(originX, top, originX, originY, Colors.Black, 2);

        for (var i = 0; i <= yTicks; i++)
        {
            var y = originY - (int)Math.Round(plotHeight * (i / (double)yTicks));
            var value = (long)Math.Round(tickStep * i);
            chart.DrawLine(originX - 6, y, originX + plotWidth, y, Colors.LightGray, 1);
            chart.DrawLine(originX - 6, y, originX, y, Colors.Black, 2);
            chart.DrawText(10, y - 8, value.ToString("N0", CultureInfo.InvariantCulture), Colors.Black, scale: 2);
        }

        var groupWidth = plotWidth / (double)ordered.Length;
        var barGap = Math.Max(4, (int)(groupWidth * 0.1));
        var barWidth = Math.Max(8, (int)((groupWidth - barGap * 3) / 2));
        var maxBarHeight = plotHeight - 10;

        for (var index = 0; index < ordered.Length; index++)
        {
            var point = ordered[index];
            var groupStart = originX + (int)Math.Round(index * groupWidth);
            var callHeight = (int)Math.Round(maxBarHeight * (point.CallOI / (double)maxValue));
            var putHeight = (int)Math.Round(maxBarHeight * (point.PutOI / (double)maxValue));

            var callX = groupStart + barGap;
            var putX = callX + barWidth + barGap;
            var callY = originY - callHeight;
            var putY = originY - putHeight;

            chart.FillRect(callX, callY, barWidth, callHeight, Colors.CallBlue);
            chart.FillRect(putX, putY, barWidth, putHeight, Colors.PutOrange);
            chart.DrawRect(callX, callY, barWidth, callHeight, Colors.Black, 1);
            chart.DrawRect(putX, putY, barWidth, putHeight, Colors.Black, 1);

            chart.DrawText(groupStart, originY + 14, point.StrikePrice.ToString("0.##", CultureInfo.InvariantCulture), Colors.Black, scale: 1);
        }

        return chart.ToPng();
    }

    private static class Colors
    {
        public static readonly Rgba White = new(255, 255, 255);
        public static readonly Rgba Black = new(20, 20, 20);
        public static readonly Rgba DarkSlateGray = new(47, 79, 79);
        public static readonly Rgba LightGray = new(230, 230, 230);
        public static readonly Rgba CallBlue = new(66, 133, 244);
        public static readonly Rgba PutOrange = new(251, 140, 0);
    }

    private sealed class PngCanvas
    {
        private readonly Rgba[] _pixels;

        public PngCanvas(int width, int height)
        {
            Width = width;
            Height = height;
            _pixels = new Rgba[width * height];
        }

        public int Width { get; }
        public int Height { get; }

        public void Fill(Rgba color)
        {
            Array.Fill(_pixels, color);
        }

        public void FillRect(int x, int y, int width, int height, Rgba color)
        {
            if (width <= 0 || height <= 0)
            {
                return;
            }

            var x0 = Math.Max(0, x);
            var y0 = Math.Max(0, y);
            var x1 = Math.Min(Width, x + width);
            var y1 = Math.Min(Height, y + height);

            for (var yy = y0; yy < y1; yy++)
            {
                var row = yy * Width;
                for (var xx = x0; xx < x1; xx++)
                {
                    _pixels[row + xx] = color;
                }
            }
        }

        public void DrawRect(int x, int y, int width, int height, Rgba color, int thickness)
        {
            for (var i = 0; i < thickness; i++)
            {
                DrawLine(x + i, y + i, x + width - 1 - i, y + i, color, 1);
                DrawLine(x + width - 1 - i, y + i, x + width - 1 - i, y + height - 1 - i, color, 1);
                DrawLine(x + width - 1 - i, y + height - 1 - i, x + i, y + height - 1 - i, color, 1);
                DrawLine(x + i, y + height - 1 - i, x + i, y + i, color, 1);
            }
        }

        public void DrawLine(int x0, int y0, int x1, int y1, Rgba color, int thickness)
        {
            var dx = Math.Abs(x1 - x0);
            var dy = -Math.Abs(y1 - y0);
            var sx = x0 < x1 ? 1 : -1;
            var sy = y0 < y1 ? 1 : -1;
            var err = dx + dy;

            while (true)
            {
                for (var tx = -thickness / 2; tx <= thickness / 2; tx++)
                {
                    for (var ty = -thickness / 2; ty <= thickness / 2; ty++)
                    {
                        SetPixel(x0 + tx, y0 + ty, color);
                    }
                }

                if (x0 == x1 && y0 == y1)
                {
                    break;
                }

                var e2 = 2 * err;
                if (e2 >= dy)
                {
                    err += dy;
                    x0 += sx;
                }

                if (e2 <= dx)
                {
                    err += dx;
                    y0 += sy;
                }
            }
        }

        public void DrawTitle(string title, string subtitle)
        {
            DrawText(36, 20, title, Colors.DarkSlateGray, scale: 3);
            DrawText(36, 60, subtitle, Colors.Black, scale: 2);
        }

        public void DrawLegend()
        {
            var legendX = Width - 330;
            var legendY = 18;

            FillRect(legendX, legendY, 300, 54, new Rgba(248, 248, 248));
            DrawRect(legendX, legendY, 300, 54, Colors.Black, 1);

            FillRect(legendX + 16, legendY + 14, 22, 22, Colors.CallBlue);
            FillRect(legendX + 16, legendY + 34, 22, 4, Colors.CallBlue);
            DrawText(legendX + 48, legendY + 11, "CALL OI", Colors.Black, scale: 2);

            FillRect(legendX + 165, legendY + 14, 22, 22, Colors.PutOrange);
            FillRect(legendX + 165, legendY + 34, 22, 4, Colors.PutOrange);
            DrawText(legendX + 197, legendY + 11, "PUT OI", Colors.Black, scale: 2);
        }

        public void DrawText(int x, int y, string text, Rgba color, int scale)
        {
            var cursor = x;
            foreach (var ch in text.ToUpperInvariant())
            {
                if (ch == '\n')
                {
                    y += 8 * scale + 2;
                    cursor = x;
                    continue;
                }

                if (Glyphs.TryGetValue(ch, out var glyph))
                {
                    DrawGlyph(cursor, y, glyph, color, scale);
                    cursor += (glyph[0].Length + 1) * scale;
                }
                else
                {
                    cursor += 4 * scale;
                }
            }
        }

        private void DrawGlyph(int x, int y, string[] glyph, Rgba color, int scale)
        {
            for (var row = 0; row < glyph.Length; row++)
            {
                var pattern = glyph[row];
                for (var col = 0; col < pattern.Length; col++)
                {
                    if (pattern[col] != '#')
                    {
                        continue;
                    }

                    FillRect(x + col * scale, y + row * scale, scale, scale, color);
                }
            }
        }

        private void SetPixel(int x, int y, Rgba color)
        {
            if ((uint)x >= (uint)Width || (uint)y >= (uint)Height)
            {
                return;
            }

            _pixels[y * Width + x] = color;
        }

        public byte[] ToPng()
        {
            using var raw = new MemoryStream();
            for (var y = 0; y < Height; y++)
            {
                raw.WriteByte(0); // no filter
                for (var x = 0; x < Width; x++)
                {
                    var px = _pixels[y * Width + x];
                    raw.WriteByte(px.R);
                    raw.WriteByte(px.G);
                    raw.WriteByte(px.B);
                    raw.WriteByte(px.A);
                }
            }

            using var compressed = new MemoryStream();
            using (var zlib = new ZLibStream(compressed, CompressionLevel.Optimal, leaveOpen: true))
            {
                raw.Position = 0;
                raw.CopyTo(zlib);
            }

            using var png = new MemoryStream();
            png.Write(PngSignature);
            WriteChunk(png, "IHDR", BuildIhdr(Width, Height));
            WriteChunk(png, "IDAT", compressed.ToArray());
            WriteChunk(png, "IEND", Array.Empty<byte>());
            return png.ToArray();
        }

        private static byte[] BuildIhdr(int width, int height)
        {
            var buffer = new byte[13];
            WriteInt32(buffer, 0, width);
            WriteInt32(buffer, 4, height);
            buffer[8] = 8;  // bit depth
            buffer[9] = 6;  // RGBA
            buffer[10] = 0; // compression
            buffer[11] = 0; // filter
            buffer[12] = 0; // interlace
            return buffer;
        }

        private static void WriteChunk(Stream stream, string type, byte[] data)
        {
            var length = BitConverter.GetBytes(IPAddress.HostToNetworkOrder(data.Length));
            stream.Write(length, 0, length.Length);

            var typeBytes = Encoding.ASCII.GetBytes(type);
            stream.Write(typeBytes, 0, typeBytes.Length);
            stream.Write(data, 0, data.Length);

            var crc = Crc32.Compute(typeBytes, data);
            var crcBytes = BitConverter.GetBytes(IPAddress.HostToNetworkOrder((int)crc));
            stream.Write(crcBytes, 0, crcBytes.Length);
        }

        private static void WriteInt32(byte[] buffer, int offset, int value)
        {
            var bytes = BitConverter.GetBytes(IPAddress.HostToNetworkOrder(value));
            Buffer.BlockCopy(bytes, 0, buffer, offset, 4);
        }

        private static readonly byte[] PngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    }

    private readonly record struct Rgba(byte R, byte G, byte B, byte A = 255);

    private static class Glyphs
    {
        public static readonly Dictionary<char, string[]> Table = new()
        {
            [' '] = new[] { "     ", "     ", "     ", "     ", "     ", "     ", "     " },
            ['A'] = new[] { " ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #" },
            ['B'] = new[] { "#### ", "#   #", "#   #", "#### ", "#   #", "#   #", "#### " },
            ['C'] = new[] { " ####", "#    ", "#    ", "#    ", "#    ", "#    ", " ####" },
            ['D'] = new[] { "#### ", "#   #", "#   #", "#   #", "#   #", "#   #", "#### " },
            ['E'] = new[] { "#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####" },
            ['F'] = new[] { "#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#    " },
            ['G'] = new[] { " ####", "#    ", "#    ", "#  ##", "#   #", "#   #", " ####" },
            ['H'] = new[] { "#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #" },
            ['I'] = new[] { "#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "#####" },
            ['J'] = new[] { "#####", "   # ", "   # ", "   # ", "#  # ", "#  # ", " ##  " },
            ['K'] = new[] { "#   #", "#  # ", "# #  ", "##   ", "# #  ", "#  # ", "#   #" },
            ['L'] = new[] { "#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####" },
            ['M'] = new[] { "#   #", "## ##", "# # #", "#   #", "#   #", "#   #", "#   #" },
            ['N'] = new[] { "#   #", "##  #", "# # #", "#  ##", "#   #", "#   #", "#   #" },
            ['O'] = new[] { " ### ", "#   #", "#   #", "#   #", "#   #", "#   #", " ### " },
            ['P'] = new[] { "#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    " },
            ['Q'] = new[] { " ### ", "#   #", "#   #", "#   #", "# # #", "#  # ", " ## #" },
            ['R'] = new[] { "#### ", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #" },
            ['S'] = new[] { " ####", "#    ", "#    ", " ### ", "    #", "    #", "#### " },
            ['T'] = new[] { "#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  " },
            ['U'] = new[] { "#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### " },
            ['V'] = new[] { "#   #", "#   #", "#   #", "#   #", " # # ", " # # ", "  #  " },
            ['W'] = new[] { "#   #", "#   #", "#   #", "# # #", "# # #", "## ##", "#   #" },
            ['X'] = new[] { "#   #", " # # ", "  #  ", "  #  ", "  #  ", " # # ", "#   #" },
            ['Y'] = new[] { "#   #", " # # ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  " },
            ['Z'] = new[] { "#####", "   # ", "  #  ", "  #  ", " #   ", "#    ", "#####" },
            ['0'] = new[] { " ### ", "#   #", "#  ##", "# # #", "##  #", "#   #", " ### " },
            ['1'] = new[] { "  #  ", " ##  ", "# #  ", "  #  ", "  #  ", "  #  ", "#####"},
            ['2'] = new[] { " ### ", "#   #", "    #", "   # ", "  #  ", " #   ", "#####" },
            ['3'] = new[] { " ### ", "#   #", "    #", " ### ", "    #", "#   #", " ### " },
            ['4'] = new[] { "#   #", "#   #", "#   #", "#####", "    #", "    #", "    #" },
            ['5'] = new[] { "#####", "#    ", "#    ", "#### ", "    #", "    #", "#### " },
            ['6'] = new[] { " ### ", "#    ", "#    ", "#### ", "#   #", "#   #", " ### " },
            ['7'] = new[] { "#####", "    #", "   # ", "  #  ", "  #  ", "  #  ", "  #  " },
            ['8'] = new[] { " ### ", "#   #", "#   #", " ### ", "#   #", "#   #", " ### " },
            ['9'] = new[] { " ### ", "#   #", "#   #", " ####", "    #", "    #", " ### " },
            ['-'] = new[] { "     ", "     ", "     ", "#####", "     ", "     ", "     " },
            ['.'] = new[] { "     ", "     ", "     ", "     ", "     ", " ### ", " ### " },
            [':'] = new[] { "     ", " ### ", " ### ", "     ", " ### ", " ### ", "     " },
            ['/'] = new[] { "    #", "   # ", "   # ", "  #  ", " #   ", "#    ", "#    " },
            ['('] = new[] { "   ##", "  #  ", " #   ", " #   ", " #   ", "  #  ", "   ##" },
            [')'] = new[] { "##   ", "  #  ", "   # ", "   # ", "   # ", "  #  ", "##   " }
        };

        public static bool TryGetValue(char ch, out string[] glyph) => Table.TryGetValue(ch, out glyph!);
    }

    private static class Crc32
    {
        private static readonly uint[] Table = CreateTable();

        public static uint Compute(byte[] typeBytes, byte[] data)
        {
            var crc = 0xFFFFFFFFu;
            crc = Update(crc, typeBytes);
            crc = Update(crc, data);
            return ~crc;
        }

        private static uint Update(uint crc, byte[] bytes)
        {
            foreach (var b in bytes)
            {
                crc = Table[(crc ^ b) & 0xFF] ^ (crc >> 8);
            }

            return crc;
        }

        private static uint[] CreateTable()
        {
            const uint polynomial = 0xEDB88320u;
            var table = new uint[256];
            for (uint i = 0; i < table.Length; i++)
            {
                var crc = i;
                for (var j = 0; j < 8; j++)
                {
                    crc = (crc & 1) != 0 ? polynomial ^ (crc >> 1) : crc >> 1;
                }

                table[i] = crc;
            }

            return table;
        }
    }
}
