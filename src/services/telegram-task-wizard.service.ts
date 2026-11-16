import { prisma } from '@/lib/prisma';
import { buildCancelKeyboard, buildMainMenuKeyboard } from '@/lib/telegram-keyboards';
import type { TelegramInlineKeyboardMarkup } from '@/lib/telegram-client';
import { InstallationTaskService } from './installation-task.service';

type ConversationState =
  | 'SELECT_PRODUCT'
  | 'ENTER_QUANTITY'
  | 'ENTER_ASSIGNEE'
  | 'ENTER_LOCATION'
  | 'ENTER_NOTES'
  | 'CONFIRM'
  | 'PROCESSING'
  | 'SEARCH_PRODUCT';

interface ConversationData {
  productId?: string;
  quantity?: number;
  assigneeName?: string;
  location?: string;
  notes?: string | null;
}

interface WizardResult {
  replyText: string;
  success: boolean;
  actionTaken?: string;
  error?: string;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}

const PRODUCT_PAGE_SIZE = 8;

export class TelegramTaskWizardService {
  static async start(telegramUserId: string, chatId: string): Promise<WizardResult> {
    await this.saveConversation(telegramUserId, chatId, 'SELECT_PRODUCT', {});
    return this.showProducts(telegramUserId, 0);
  }

  static async handleCallback(
    telegramUserId: string,
    chatId: string,
    internalUserId: string,
    isAllowedAdmin: boolean,
    callbackData: string
  ): Promise<WizardResult> {
    if (callbackData === 'menu:create_task') {
      if (!isAllowedAdmin) return this.accessDenied();
      return this.start(telegramUserId, chatId);
    }

    if (callbackData === 'menu:search') {
      await this.saveConversation(telegramUserId, chatId, 'SEARCH_PRODUCT', {});
      return {
        replyText: 'Kirim nama barang atau SKU yang ingin dicari.',
        success: true,
        actionTaken: 'SEARCH_PROMPT',
        replyMarkup: buildCancelKeyboard(),
      };
    }

    if (callbackData === 'task:cancel') {
      await prisma.telegramConversation.deleteMany({ where: { telegramUserId } });
      return {
        replyText: 'Proses dibatalkan. Pilih menu yang ingin digunakan:',
        success: true,
        actionTaken: 'TASK_CANCELLED',
        replyMarkup: buildMainMenuKeyboard(isAllowedAdmin),
      };
    }

    if (callbackData.startsWith('task:')) {
      if (!isAllowedAdmin) return this.accessDenied();

      const parts = callbackData.split(':');
      if (parts[1] === 'products') {
        const offset = Number(parts[2]);
        if (!Number.isSafeInteger(offset) || offset < 0) return this.invalidAction();
        const conversation = await this.getConversation(telegramUserId, 'SELECT_PRODUCT');
        if (!conversation) return this.staleAction(isAllowedAdmin);
        return this.showProducts(telegramUserId, offset);
      }

      if (parts[1] === 'product' && parts[2]) {
        return this.selectProduct(telegramUserId, parts[2]);
      }

      if (parts[1] === 'qty' && parts[2] === 'custom') {
        const conversation = await this.getConversation(telegramUserId, 'ENTER_QUANTITY');
        if (!conversation) return this.staleAction(isAllowedAdmin);
        return {
          replyText: 'Ketik jumlah barang yang akan dipasang (bilangan bulat lebih dari 0).',
          success: true,
          actionTaken: 'TASK_QUANTITY_PROMPT',
          replyMarkup: buildCancelKeyboard(),
        };
      }

      if (parts[1] === 'qty' && parts[2]) {
        const quantity = Number(parts[2]);
        if (!Number.isSafeInteger(quantity)) return this.invalidAction();
        return this.setQuantity(telegramUserId, quantity);
      }

      if (parts[1] === 'notes' && parts[2] === 'skip') {
        const conversation = await this.getConversation(telegramUserId, 'ENTER_NOTES');
        if (!conversation) return this.staleAction(isAllowedAdmin);
        const data = this.readData(conversation.data);
        return this.confirm(telegramUserId, chatId, data);
      }

      if (parts[1] === 'confirm') {
        const conversation = await this.getConversation(telegramUserId, 'CONFIRM');
        if (!conversation) return this.staleAction(isAllowedAdmin);
        return this.createTask(telegramUserId, internalUserId, this.readData(conversation.data));
      }
    }

    if (callbackData === 'menu:home') {
      return {
        replyText: 'Pilih menu yang ingin digunakan:',
        success: true,
        actionTaken: 'MAIN_MENU',
        replyMarkup: buildMainMenuKeyboard(isAllowedAdmin),
      };
    }

    return this.invalidAction();
  }

  static async handleText(
    telegramUserId: string,
    chatId: string,
    isAllowedAdmin: boolean,
    text: string
  ): Promise<WizardResult | null> {
    const conversation = await prisma.telegramConversation.findUnique({ where: { telegramUserId } });
    if (!conversation) return null;

    if (conversation.state === 'SEARCH_PRODUCT') {
      if (!text.trim()) return this.requiredText('Nama barang atau SKU');
      const products = await prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: text.trim(), mode: 'insensitive' } },
            { sku: { contains: text.trim().toUpperCase(), mode: 'insensitive' } },
          ],
        },
        orderBy: { name: 'asc' },
        take: 10,
      });
      await prisma.telegramConversation.deleteMany({ where: { telegramUserId } });
      const replyText = products.length
        ? products.map((product) => {
          const status = product.currentStock === 0
            ? 'Habis'
            : product.currentStock <= product.minimumStock ? 'Stok rendah' : 'Aman';
          return `• ${product.name} — ${product.currentStock} ${product.unit} (${status})`;
        }).join('\n')
        : `Barang "${text.trim()}" tidak ditemukan.`;

      return {
        replyText: `${replyText}\n\nPilih menu berikutnya:`,
        success: true,
        actionTaken: products.length ? 'SEARCH_RESULTS' : 'SEARCH_EMPTY',
        replyMarkup: buildMainMenuKeyboard(isAllowedAdmin),
      };
    }

    if (!isAllowedAdmin) return this.accessDenied();

    const data = this.readData(conversation.data);
    if (conversation.state === 'SELECT_PRODUCT') {
      if (!text.trim()) {
        return {
          replyText: 'Pilih barang dari tombol atau ketik nama barang untuk mencari.',
          success: true,
          actionTaken: 'TASK_PRODUCT_SELECTION',
          replyMarkup: await this.productKeyboardForPage(0),
        };
      }

      const matches = await prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: text.trim(), mode: 'insensitive' } },
            { sku: { contains: text.trim().toUpperCase(), mode: 'insensitive' } },
          ],
        },
        orderBy: { name: 'asc' },
        take: PRODUCT_PAGE_SIZE,
      });

      if (matches.length === 1) return this.selectProduct(telegramUserId, matches[0].id);
      if (matches.length > 1) {
        return {
          replyText: `Ditemukan beberapa barang yang cocok dengan "${text.trim()}". Pilih salah satu:`,
          success: true,
          actionTaken: 'TASK_PRODUCT_MATCHES',
          replyMarkup: this.productKeyboard(matches, 0, false),
        };
      }

      return {
        replyText: `Barang "${text.trim()}" tidak ditemukan. Pilih dari daftar atau coba kata kunci lain:`,
        success: false,
        actionTaken: 'TASK_PRODUCT_NOT_FOUND',
        replyMarkup: await this.productKeyboardForPage(0),
      };
    }

    if (conversation.state === 'ENTER_QUANTITY') {
      const quantity = Number(text.trim());
      return this.setQuantity(telegramUserId, quantity);
    }

    if (conversation.state === 'ENTER_ASSIGNEE') {
      if (!text.trim()) return this.requiredText('Nama pemasang');
      await this.saveConversation(telegramUserId, chatId, 'ENTER_LOCATION', {
        ...data,
        assigneeName: text.trim(),
      });
      return {
        replyText: `Pemasang dicatat: ${text.trim()}.\n\nSekarang ketik lokasi pemasangan.`,
        success: true,
        actionTaken: 'TASK_LOCATION_PROMPT',
        replyMarkup: buildCancelKeyboard(),
      };
    }

    if (conversation.state === 'ENTER_LOCATION') {
      if (!text.trim()) return this.requiredText('Lokasi pemasangan');
      await this.saveConversation(telegramUserId, chatId, 'ENTER_NOTES', {
        ...data,
        location: text.trim(),
      });
      return {
        replyText: `Lokasi dicatat: ${text.trim()}.\n\nTambahkan catatan? Ketik catatan atau tekan Lewati.`,
        success: true,
        actionTaken: 'TASK_NOTES_PROMPT',
        replyMarkup: {
          inline_keyboard: [
            [{ text: 'Lewati catatan', callback_data: 'task:notes:skip' }],
            [{ text: '✖️ Batal', callback_data: 'task:cancel' }],
          ],
        },
      };
    }

    if (conversation.state === 'ENTER_NOTES') {
      return this.confirm(telegramUserId, chatId, { ...data, notes: text.trim() || null });
    }

    if (conversation.state === 'CONFIRM') {
      return {
        replyText: 'Periksa ringkasan di atas, lalu tekan tombol Buat tugas atau Batal.',
        success: true,
        actionTaken: 'TASK_CONFIRMATION_REQUIRED',
        replyMarkup: this.confirmKeyboard(),
      };
    }

    return this.invalidAction();
  }

  private static async showProducts(telegramUserId: string, offset: number): Promise<WizardResult> {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      skip: offset,
      take: PRODUCT_PAGE_SIZE + 1,
    });

    const pageProducts = products.slice(0, PRODUCT_PAGE_SIZE);
    if (!pageProducts.length && offset === 0) {
      await prisma.telegramConversation.deleteMany({ where: { telegramUserId } });
      return {
        replyText: 'Belum ada barang aktif di katalog. Tambahkan barang terlebih dahulu di web.',
        success: false,
        actionTaken: 'TASK_NO_PRODUCTS',
      };
    }
    if (!pageProducts.length) {
      return {
        replyText: 'Tidak ada barang lain di halaman berikutnya.',
        success: true,
        actionTaken: 'TASK_PRODUCT_SELECTION',
        replyMarkup: this.productKeyboard([], offset, false),
      };
    }

    return {
      replyText: `Pilih barang yang akan dipasang${offset ? ' (halaman berikutnya)' : ''}:`,
      success: true,
      actionTaken: 'TASK_PRODUCT_SELECTION',
      replyMarkup: this.productKeyboard(pageProducts, offset, products.length > PRODUCT_PAGE_SIZE),
    };
  }

  private static async productKeyboardForPage(offset: number): Promise<TelegramInlineKeyboardMarkup> {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      skip: offset,
      take: PRODUCT_PAGE_SIZE + 1,
    });
    return this.productKeyboard(products.slice(0, PRODUCT_PAGE_SIZE), offset, products.length > PRODUCT_PAGE_SIZE);
  }

  private static productKeyboard(
    products: Array<{ id: string; name: string; currentStock: number; unit: string }>,
    offset: number,
    hasNextPage: boolean
  ): TelegramInlineKeyboardMarkup {
    const keyboard = products.map((product) => [{
      text: `${product.name.slice(0, 40)} — ${product.currentStock} ${product.unit}`,
      callback_data: `task:product:${product.id}`,
    }]);

    const pagination = [];
    if (offset > 0) pagination.push({ text: '⬅️ Sebelumnya', callback_data: `task:products:${Math.max(0, offset - PRODUCT_PAGE_SIZE)}` });
    if (hasNextPage) pagination.push({ text: 'Berikutnya ➡️', callback_data: `task:products:${offset + PRODUCT_PAGE_SIZE}` });
    if (pagination.length) keyboard.push(pagination);
    keyboard.push([{ text: '✖️ Batal', callback_data: 'task:cancel' }]);

    return { inline_keyboard: keyboard };
  }

  private static async selectProduct(telegramUserId: string, productId: string): Promise<WizardResult> {
    const conversation = await this.getConversation(telegramUserId, 'SELECT_PRODUCT');
    if (!conversation) return this.staleAction(true);

    const product = await prisma.product.findFirst({
      where: { id: productId, isActive: true },
    });
    if (!product) {
      return {
        replyText: 'Barang tidak lagi aktif. Silakan pilih barang lain.',
        success: false,
        actionTaken: 'TASK_PRODUCT_INACTIVE',
        replyMarkup: await this.productKeyboardForPage(0),
      };
    }
    if (product.currentStock === 0) {
      return {
        replyText: `${product.name} sedang tidak memiliki stok. Pilih barang lain.`,
        success: false,
        actionTaken: 'TASK_PRODUCT_OUT_OF_STOCK',
        replyMarkup: await this.productKeyboardForPage(0),
      };
    }

    await this.saveConversation(telegramUserId, conversation.chatId, 'ENTER_QUANTITY', {
      productId: product.id,
    });
    return {
      replyText: `Barang dipilih: ${product.name}\nStok tercatat: ${product.currentStock} ${product.unit}\n\nPilih jumlah atau ketik jumlah lain:`,
      success: true,
      actionTaken: 'TASK_QUANTITY_SELECTION',
      replyMarkup: this.quantityKeyboard(product.currentStock),
    };
  }

  private static quantityKeyboard(availableStock = Number.MAX_SAFE_INTEGER): TelegramInlineKeyboardMarkup {
    const choices = [1, 2, 3, 5, 10].filter((quantity) => quantity <= availableStock);
    const keyboard: TelegramInlineKeyboardMarkup['inline_keyboard'] = [];
    for (let index = 0; index < choices.length; index += 2) {
      keyboard.push(choices.slice(index, index + 2).map((quantity) => ({
        text: String(quantity),
        callback_data: `task:qty:${quantity}`,
      })));
    }
    keyboard.push([{ text: 'Ketik jumlah lain', callback_data: 'task:qty:custom' }]);
    keyboard.push([{ text: '✖️ Batal', callback_data: 'task:cancel' }]);
    return { inline_keyboard: keyboard };
  }

  private static async setQuantity(telegramUserId: string, quantity: number): Promise<WizardResult> {
    const conversation = await this.getConversation(telegramUserId, 'ENTER_QUANTITY');
    if (!conversation) return this.staleAction(true);
    const data = this.readData(conversation.data);
    const product = data.productId
      ? await prisma.product.findUnique({ where: { id: data.productId } })
      : null;
    if (!product || !product.isActive) return this.staleAction(true);
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > product.currentStock) {
      return {
        replyText: `Jumlah harus antara 1 dan ${product.currentStock} ${product.unit}. Silakan pilih atau ketik kembali.`,
        success: false,
        actionTaken: 'TASK_INVALID_QUANTITY',
        replyMarkup: this.quantityKeyboard(product.currentStock),
      };
    }

    await this.saveConversation(telegramUserId, conversation.chatId, 'ENTER_ASSIGNEE', {
      ...data,
      quantity,
    });
    return {
      replyText: `Jumlah: ${quantity} ${product.unit}.\n\nKetik nama pemasang.`,
      success: true,
      actionTaken: 'TASK_ASSIGNEE_PROMPT',
      replyMarkup: buildCancelKeyboard(),
    };
  }

  private static async confirm(
    telegramUserId: string,
    chatId: string,
    data: ConversationData
  ): Promise<WizardResult> {
    const product = data.productId
      ? await prisma.product.findUnique({ where: { id: data.productId } })
      : null;
    if (!product || !data.quantity || !data.assigneeName || !data.location) {
      return this.staleAction(true);
    }

    await this.saveConversation(telegramUserId, chatId, 'CONFIRM', data);
    return {
      replyText:
        `Periksa tugas pemasangan:\n\n` +
        `Barang: ${product.name}\n` +
        `Jumlah: ${data.quantity} ${product.unit}\n` +
        `Pemasang: ${data.assigneeName}\n` +
        `Lokasi: ${data.location}\n` +
        `Catatan: ${data.notes || '-'}\n\n` +
        `Lanjut buat tugas dan link bukti?`,
      success: true,
      actionTaken: 'TASK_CONFIRMATION',
      replyMarkup: this.confirmKeyboard(),
    };
  }

  private static confirmKeyboard(): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: '✅ Buat tugas', callback_data: 'task:confirm' }],
        [{ text: '✖️ Batal', callback_data: 'task:cancel' }],
      ],
    };
  }

  private static async createTask(
    telegramUserId: string,
    internalUserId: string,
    data: ConversationData
  ): Promise<WizardResult> {
    if (!data.productId || !data.quantity || !data.assigneeName || !data.location) {
      return this.staleAction(true);
    }

    const claimed = await prisma.telegramConversation.updateMany({
      where: { telegramUserId, state: 'CONFIRM' },
      data: { state: 'PROCESSING' },
    });
    if (claimed.count !== 1) return this.staleAction(true);

    let task: Awaited<ReturnType<typeof InstallationTaskService.create>>['task'];
    let token: string;
    try {
      ({ task, token } = await InstallationTaskService.create({
        productId: data.productId,
        quantity: data.quantity,
        assigneeName: data.assigneeName,
        location: data.location,
        notes: data.notes ?? undefined,
        creatorUserId: internalUserId,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membuat tugas.';
      await prisma.telegramConversation.updateMany({
        where: { telegramUserId, state: 'PROCESSING' },
        data: { state: 'ENTER_QUANTITY' },
      });
      return {
        replyText: `Tugas belum dibuat: ${message}\n\nSilakan ubah jumlah atau batalkan.`,
        success: false,
        actionTaken: 'INSTALLATION_TASK_FAILED',
        error: message,
        replyMarkup: {
          inline_keyboard: [
            [{ text: 'Ubah jumlah', callback_data: 'task:qty:custom' }],
            [{ text: '✖️ Batal', callback_data: 'task:cancel' }],
          ],
        },
      };
    }

    try {
      await prisma.telegramConversation.deleteMany({ where: { telegramUserId } });
    } catch (error) {
      console.error('Tugas berhasil dibuat tetapi sesi Telegram tidak dapat dibersihkan:', error);
    }

    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const proofUrl = `${appUrl}/proof/${token}`;
    const whatsappMessage = encodeURIComponent(
      `Halo ${task.assigneeName}, mohon selesaikan tugas pemasangan ${task.product.name} di ${task.location} dan kirim foto bukti melalui link ini: ${proofUrl}`
    );

    return {
      replyText:
        `✅ Tugas pemasangan berhasil dibuat.\n` +
        `Barang: ${task.product.name} (${task.quantity} ${task.product.unit})\n` +
        `Pemasang: ${task.assigneeName}\n` +
        `Lokasi: ${task.location}\n` +
        `Status: Menunggu bukti foto\n\n` +
        `Link bukti: ${proofUrl}\n` +
        `Stok berkurang setelah foto bukti berhasil dikirim.`,
      success: true,
      actionTaken: 'INSTALLATION_TASK_CREATED',
      replyMarkup: {
        inline_keyboard: [
          [{ text: '📲 Bagikan melalui WhatsApp', url: `https://wa.me/?text=${whatsappMessage}` }],
          [{ text: '➕ Buat tugas lain', callback_data: 'menu:create_task' }],
          [{ text: '🏠 Menu utama', callback_data: 'menu:home' }],
        ],
      },
    };
  }

  private static async saveConversation(
    telegramUserId: string,
    chatId: string,
    state: ConversationState,
    data: ConversationData
  ) {
    return prisma.telegramConversation.upsert({
      where: { telegramUserId },
      update: { chatId, state, data: JSON.stringify(data) },
      create: { telegramUserId, chatId, state, data: JSON.stringify(data) },
    });
  }

  private static async getConversation(telegramUserId: string, state: ConversationState) {
    return prisma.telegramConversation.findFirst({ where: { telegramUserId, state } });
  }

  private static readData(rawData: string): ConversationData {
    const data: unknown = JSON.parse(rawData);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Data percakapan Telegram tidak valid.');
    }
    return data as ConversationData;
  }

  private static requiredText(field: string): WizardResult {
    return {
      replyText: `${field} wajib diisi. Silakan ketik kembali atau tekan Batal.`,
      success: false,
      actionTaken: 'TASK_INPUT_REQUIRED',
      replyMarkup: buildCancelKeyboard(),
    };
  }

  private static accessDenied(): WizardResult {
    return {
      replyText: 'Akses ditolak. Fitur ini hanya tersedia untuk admin Telegram yang sudah diizinkan.',
      success: false,
      actionTaken: 'ACCESS_DENIED',
      replyMarkup: buildMainMenuKeyboard(false),
    };
  }

  private static invalidAction(): WizardResult {
    return {
      replyText: 'Pilihan tidak dikenali. Silakan mulai kembali dari menu.',
      success: false,
      actionTaken: 'INVALID_BUTTON',
    };
  }

  private static staleAction(isAllowedAdmin: boolean): WizardResult {
    return {
      replyText: 'Sesi ini sudah berakhir. Silakan mulai lagi dari menu.',
      success: false,
      actionTaken: 'TASK_SESSION_EXPIRED',
      replyMarkup: buildMainMenuKeyboard(isAllowedAdmin),
    };
  }
}
