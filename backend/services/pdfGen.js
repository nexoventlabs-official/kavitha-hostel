/**
 * Generate the resident registration form PDF (the document sent to the user
 * via WhatsApp right after they finish the web registration).
 *
 * Output is an in-memory Buffer the caller uploads to Cloudinary.
 */
const PDFDocument = require('pdfkit');
const axios = require('axios');

async function fetchImage(url) {
  if (!url) return null;
  try {
    const resp = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 8 * 1024 * 1024,
    });
    return Buffer.from(resp.data);
  } catch (err) {
    console.warn('[pdfGen] fetchImage failed for', url, err.message);
    return null;
  }
}

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * @param {object} input
 * @param {object} input.user       — User document (plain object)
 * @param {object} input.branch     — Branch document (plain object)
 * @returns Promise<Buffer>
 */
async function buildRegistrationPdf({ user, branch }) {
  const [photoBuf, aadharBuf] = await Promise.all([
    fetchImage(user.photoUrl),
    fetchImage(user.aadharUrl),
  ]);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const margin = doc.page.margins.left;
      const contentWidth = pageWidth - margin * 2;

      // ─── Header band ───
      doc.save();
      doc.rect(0, 0, pageWidth, 90).fill('#1f3b6b');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text(
        'KAVITHA PG — RESIDENT REGISTRATION',
        margin,
        28,
        { width: contentWidth, align: 'center' }
      );
      doc.fontSize(11).font('Helvetica').text(
        branch?.name ? `Branch: ${branch.name}` : 'Branch: —',
        margin,
        62,
        { width: contentWidth, align: 'center' }
      );
      doc.restore();

      doc.y = 110;

      // ─── Photo + key info row ───
      const photoBoxX = margin;
      const photoBoxY = doc.y;
      const photoW = 110;
      const photoH = 140; // passport ratio approx 35x45 mm

      doc.save();
      doc.rect(photoBoxX, photoBoxY, photoW, photoH).lineWidth(1).strokeColor('#1f3b6b').stroke();
      if (photoBuf) {
        try {
          doc.image(photoBuf, photoBoxX + 2, photoBoxY + 2, {
            fit: [photoW - 4, photoH - 4],
            align: 'center',
            valign: 'center',
          });
        } catch {
          doc.fontSize(10).fillColor('#888').text('Photo', photoBoxX, photoBoxY + photoH / 2 - 5, {
            width: photoW,
            align: 'center',
          });
        }
      } else {
        doc.fontSize(10).fillColor('#888').text('No Photo', photoBoxX, photoBoxY + photoH / 2 - 5, {
          width: photoW,
          align: 'center',
        });
      }
      doc.restore();

      // Key details next to photo
      const infoX = photoBoxX + photoW + 16;
      const infoW = contentWidth - photoW - 16;
      let infoY = photoBoxY;

      const keyVal = (k, v) => {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#1f3b6b').text(k, infoX, infoY, {
          width: infoW,
          continued: false,
        });
        doc.font('Helvetica').fontSize(11).fillColor('#111').text(v || '—', infoX, infoY + 12, {
          width: infoW,
        });
        infoY += 30;
      };

      keyVal('Full Name', user.name);
      keyVal('WhatsApp Number', `+${user.phone}`);
      keyVal('Branch / Block', `${branch?.name || user.branchCode || '—'} / ${user.block || '—'}`);
      keyVal('Room No. & Date Joined', `Room ${user.roomNumber || '—'}  •  ${fmtDate(user.dateJoined)}`);

      doc.y = Math.max(photoBoxY + photoH, infoY) + 16;

      // ─── Section: Personal Details ───
      const section = (title) => {
        doc.moveDown(0.5);
        doc.save();
        doc
          .rect(margin, doc.y, contentWidth, 22)
          .fill('#eef2fa');
        doc.fillColor('#1f3b6b').font('Helvetica-Bold').fontSize(12).text(title, margin + 8, doc.y + 5, {
          width: contentWidth - 16,
        });
        doc.restore();
        doc.y += 30;
      };

      const field = (label, value, opts = {}) => {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#1f3b6b').text(`${label}:`, margin, doc.y, {
          continued: true,
          width: contentWidth,
        });
        doc.font('Helvetica').fontSize(11).fillColor('#111').text(`  ${value || '—'}`, {
          width: contentWidth,
        });
        if (!opts.tight) doc.moveDown(0.25);
      };

      section('Personal Details');
      field('Age', user.age ? String(user.age) : '—');
      field('Gender', user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : '—');
      field('Optional Mobile', user.mobile || '—');
      field('Working / Study Location', user.workAddress || '—');

      section('Parent / Guardian Details');
      field("Father's Name", user.fatherName);
      field("Father's Mobile", user.fatherMobile);
      field("Mother's Name", user.motherName);
      field("Mother's Mobile", user.motherMobile);
      field('Permanent Living Address', user.livingAddress);

      section('ID Proof');
      const aadharBoxY = doc.y + 4;
      const aadharBoxW = 200;
      const aadharBoxH = 120;
      doc.rect(margin, aadharBoxY, aadharBoxW, aadharBoxH).strokeColor('#1f3b6b').lineWidth(1).stroke();
      if (aadharBuf) {
        try {
          doc.image(aadharBuf, margin + 2, aadharBoxY + 2, {
            fit: [aadharBoxW - 4, aadharBoxH - 4],
            align: 'center',
            valign: 'center',
          });
        } catch {
          doc.fontSize(10).fillColor('#888').text(
            'Aadhar Proof',
            margin,
            aadharBoxY + aadharBoxH / 2 - 5,
            { width: aadharBoxW, align: 'center' }
          );
        }
      } else {
        doc
          .fontSize(10)
          .fillColor('#888')
          .text('Aadhar Proof', margin, aadharBoxY + aadharBoxH / 2 - 5, {
            width: aadharBoxW,
            align: 'center',
          });
      }
      doc.y = aadharBoxY + aadharBoxH + 16;

      // ─── Footer ───
      doc.fontSize(9).fillColor('#666').font('Helvetica').text(
        `Generated on ${new Date().toLocaleString('en-GB')} • Kavitha PG`,
        margin,
        doc.page.height - 40,
        { width: contentWidth, align: 'center' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildRegistrationPdf };
