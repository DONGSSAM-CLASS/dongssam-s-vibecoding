import kr.dogfoot.hwplib.object.HWPFile;
import kr.dogfoot.hwplib.reader.HWPReader;
import kr.dogfoot.hwpxlib.object.HWPXFile;
import kr.dogfoot.hwpxlib.writer.HWPXWriter;
import kr.dogfoot.hwp2hwpx.Hwp2Hwpx;
public class Conv { public static void main(String[] a) throws Exception {
  HWPFile f = HWPReader.fromFile(a[0]); HWPXFile x = Hwp2Hwpx.toHWPX(f); HWPXWriter.toFilepath(x, a[1]); System.out.println("ok"); } }
