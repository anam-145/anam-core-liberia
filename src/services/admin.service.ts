import { AppDataSource } from '@/server/db/datasource';
import type { AdminRole } from '@/server/db/entities/Admin';
import { Admin, OnboardingStatus } from '@/server/db/entities/Admin';
import type { KycType } from '@/server/db/entities/User';
import { User, USSDStatus, RegistrationType } from '@/server/db/entities/User';
import { Event, EventStatus } from '@/server/db/entities/Event';
import type { EventRole } from '@/server/db/entities/EventStaff';
import { EventStaff } from '@/server/db/entities/EventStaff';
import { EventParticipant } from '@/server/db/entities/EventParticipant';
import { EventCheckin } from '@/server/db/entities/EventCheckin';
import { EventPayment } from '@/server/db/entities/EventPayment';
import { hash, compare } from 'bcryptjs';
import { randomUUID } from 'crypto';
import { generateWallet } from '@/utils/crypto/wallet';
import { encryptVault } from '@/utils/crypto/vault';
import { getVCDatabaseService } from '@/services/vc.db.service';
import { custodyService } from '@/services/custody.db.service';
import { getSystemAdminWallet } from '@/services/system-init.service';
import { blockchainService } from '@/services/blockchain.service';

/**
 * Admin Service
 * Handles all admin-related operations including:
 * - Admin CRUD
 * - Authentication
 * - User/Event/Payment management
 */
class AdminService {
  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  }

  /**
   * Create a new admin account
   */
  async createAdmin(data: {
    username: string;
    password: string;
    fullName: string;
    email: string;
    role: AdminRole;
    did?: string | null;
    walletAddress?: string | null;
  }): Promise<Admin> {
    await this.initialize();

    const adminRepository = AppDataSource.getRepository(Admin);

    // Check for existing username
    const existingUsername = await adminRepository.findOne({
      where: { username: data.username },
    });
    if (existingUsername) {
      throw new Error('Username already exists');
    }

    // Check for existing email (if provided)
    if (data.email) {
      const existingEmail = await adminRepository.findOne({
        where: { email: data.email },
      });
      if (existingEmail) {
        throw new Error('Email already exists');
      }
    }

    // Hash password
    const passwordHash = await hash(data.password, 10);

    // Create admin
    const admin = adminRepository.create({
      adminId: randomUUID(),
      username: data.username,
      passwordHash,
      fullName: data.fullName,
      email: data.email || null,
      role: data.role,
      isActive: true,
      onboardingStatus: OnboardingStatus.ACTIVE,
      did: data.did ?? null,
      walletAddress: data.walletAddress ?? null,
    });

    await adminRepository.save(admin);
    return admin;
  }

  /**
   * Authenticate admin
   */
  async authenticateAdmin(username: string, password: string): Promise<Admin | null> {
    await this.initialize();

    const adminRepository = AppDataSource.getRepository(Admin);

    const admin = await adminRepository.findOne({
      where: { username, isActive: true },
    });

    if (!admin) {
      return null;
    }

    const isValidPassword = await compare(password, admin.passwordHash);
    if (!isValidPassword) {
      return null;
    }

    // No lastLogin tracking (removed)
    return admin;
  }

  /**
   * Get admin by ID
   */
  async getAdminById(id: number): Promise<Admin | null> {
    await this.initialize();

    const adminRepository = AppDataSource.getRepository(Admin);
    return adminRepository.findOne({ where: { id } });
  }

  /**
   * Update admin profile
   */
  async updateAdmin(
    id: number,
    data: {
      fullName?: string;
      email?: string;
      isActive?: boolean;
    },
  ): Promise<Admin | null> {
    await this.initialize();

    const adminRepository = AppDataSource.getRepository(Admin);
    const admin = await adminRepository.findOne({ where: { id } });

    if (!admin) {
      return null;
    }

    if (data.fullName !== undefined) admin.fullName = data.fullName;
    if (data.email !== undefined) {
      // Check email uniqueness
      const existingEmail = await adminRepository.findOne({
        where: { email: data.email },
      });
      if (existingEmail && existingEmail.id !== id) {
        throw new Error('Email already exists');
      }
      admin.email = data.email;
    }
    if (data.isActive !== undefined) admin.isActive = data.isActive;

    await adminRepository.save(admin);
    return admin;
  }

  /**
   * Change admin password
   */
  async changePassword(id: number, oldPassword: string, newPassword: string): Promise<boolean> {
    await this.initialize();

    const adminRepository = AppDataSource.getRepository(Admin);
    const admin = await adminRepository.findOne({ where: { id } });

    if (!admin) {
      return false;
    }

    // Verify old password
    const isValidPassword = await compare(oldPassword, admin.passwordHash);
    if (!isValidPassword) {
      return false;
    }

    // Hash new password
    admin.passwordHash = await hash(newPassword, 10);
    await adminRepository.save(admin);
    return true;
  }

  /**
   * Get all admins
   */
  async getAllAdmins(): Promise<Admin[]> {
    await this.initialize();

    const adminRepository = AppDataSource.getRepository(Admin);
    return adminRepository.find({ order: { createdAt: 'DESC' } });
  }

  /**
   * Get users with pagination and filters
   */
  async getUsers(options: {
    ussdStatus?: USSDStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ users: User[]; total: number }> {
    await this.initialize();

    const userRepository = AppDataSource.getRepository(User);

    // Create query with JOINs for DID and VC status
    const query = userRepository
      .createQueryBuilder('user')
      .leftJoin('did_documents', 'did', 'did.wallet_address = user.wallet_address AND did.did_type = :didType', {
        didType: 'USER',
      })
      .leftJoin('vc_registry', 'vc', 'vc.user_did = did.did')
      .select([
        'user.id AS id',
        'user.user_id AS userId',
        'user.name AS name',
        'user.phone_number AS phoneNumber',
        'user.email AS email',
        'user.nationality AS nationality',
        'user.gender AS gender',
        'user.date_of_birth AS dateOfBirth',
        'user.address AS address',
        'user.wallet_address AS walletAddress',
        'user.registration_type AS registrationType',
        'user.kyc_type AS kycType',
        'user.kyc_document_path AS kycDocumentPath',
        'user.kyc_face_path AS kycFacePath',
        'user.ussd_status AS ussdStatus',
        'user.is_active AS isActive',
        'user.has_custody_wallet AS hasCustodyWallet',
        'user.created_by AS createdBy',
        'user.created_at AS createdAt',
        'user.updated_at AS updatedAt',
        'did.did AS did',
        'vc.vc_id AS vcId',
        'vc.status AS vcStatus',
      ]);

    if (options.ussdStatus) {
      query.andWhere('user.ussd_status = :ussdStatus', { ussdStatus: options.ussdStatus });
    }

    const total = await query.getCount();

    query.orderBy('user.created_at', 'DESC');

    if (options.limit) {
      query.take(options.limit);
    }

    if (options.offset) {
      query.skip(options.offset);
    }

    const rawUsers = await query.getRawMany();

    // Map raw results to User objects with additional DID and VC fields
    const users = rawUsers.map((raw) => {
      const user = new User();
      user.id = parseInt(String(raw.id));
      user.userId = raw.userId;
      user.name = raw.name;
      user.phoneNumber = raw.phoneNumber;
      user.email = raw.email;
      user.nationality = raw.nationality;
      user.gender = raw.gender;
      user.dateOfBirth = raw.dateOfBirth;
      user.address = raw.address;
      user.walletAddress = raw.walletAddress;
      user.registrationType = raw.registrationType;
      user.kycType = raw.kycType;
      user.kycDocumentPath = raw.kycDocumentPath;
      user.kycFacePath = raw.kycFacePath;
      user.ussdStatus = raw.ussdStatus;
      user.isActive = Boolean(raw.isActive);
      user.hasCustodyWallet = Boolean(raw.hasCustodyWallet);
      user.createdBy = raw.createdBy;
      user.createdAt = raw.createdAt;
      user.updatedAt = raw.updatedAt;

      // Add DID and VC fields (not part of User entity, but needed for UI)
      (user as User & { did?: string | null; vcId?: string | null; vcStatus?: string | null }).did = raw.did;
      (user as User & { did?: string | null; vcId?: string | null; vcStatus?: string | null }).vcId = raw.vcId;
      (user as User & { did?: string | null; vcId?: string | null; vcStatus?: string | null }).vcStatus = raw.vcStatus;

      return user;
    });

    return { users, total };
  }

  /**
   * Get user by ID
   */
  async getUserById(id: number): Promise<User | null> {
    await this.initialize();

    const userRepository = AppDataSource.getRepository(User);
    return userRepository.findOne({ where: { id } });
  }

  /**
   * Update user KYC information
   */
  async updateUserKyc(
    id: number,
    data: {
      kycType?: string;
      kycDocumentPath?: string;
      kycFacePath?: string;
    },
  ): Promise<User | null> {
    await this.initialize();

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id } });

    if (!user) {
      return null;
    }

    if (data.kycType !== undefined) user.kycType = (data.kycType as KycType) || null;
    if (data.kycDocumentPath !== undefined) user.kycDocumentPath = data.kycDocumentPath;
    if (data.kycFacePath !== undefined) user.kycFacePath = data.kycFacePath;

    await userRepository.save(user);
    return user;
  }

  /**
   * Create user with registration type
   */
  async createUserWithRegistrationType(
    data: {
      name: string;
      phoneNumber?: string;
      email?: string;
      gender?: string;
      dateOfBirth?: Date;
      nationality?: string;
      address?: string;
      registrationType: 'ANAMWALLET' | 'USSD' | 'PAPERVOUCHER';
      walletAddress?: string; // For AnamWallet - direct wallet address
      password?: string; // For Paper Voucher - password for vault encryption
      kycType?: string;
      kycDocumentPath?: string; // KYC document file path
      kycFacePath?: string; // KYC face photo file path
    },
    createdBy: string,
  ): Promise<User> {
    await this.initialize();

    const userRepository = AppDataSource.getRepository(User);

    // Check for existing phone number (if provided)
    if (data.phoneNumber) {
      const existingPhone = await userRepository.findOne({
        where: { phoneNumber: data.phoneNumber },
      });
      if (existingPhone) {
        throw new Error('Phone number already exists');
      }
    }

    // Registration type specific validations and setup
    let walletAddress: string | null = null;
    let ussdStatus: USSDStatus = USSDStatus.NOT_APPLICABLE;

    switch (data.registrationType) {
      case 'ANAMWALLET': {
        if (!data.walletAddress) {
          throw new Error('Wallet address is required for AnamWallet');
        }

        // Validate and normalize Ethereum address
        const ethers = await import('ethers');
        if (!ethers.isAddress(data.walletAddress)) {
          throw new Error('Invalid Ethereum address format');
        }

        walletAddress = ethers.getAddress(data.walletAddress); // Checksummed format

        // Check if wallet address already exists
        const existingWallet = await userRepository.findOne({
          where: { walletAddress },
        });
        if (existingWallet) {
          throw new Error('Wallet address already exists');
        }

        // Send gas subsidy for AnamWallet users (one-time on registration)
        const systemWallet = getSystemAdminWallet();
        await blockchainService.sendGasSubsidy(walletAddress, systemWallet.privateKey);
        break;
      }

      case 'USSD': {
        if (!data.phoneNumber) {
          throw new Error('Phone number is required for USSD wallet');
        }
        ussdStatus = USSDStatus.PENDING;
        break;
      }

      case 'PAPERVOUCHER': {
        if (!data.password) {
          throw new Error('Password is required for Paper Voucher');
        }

        // 1) Generate wallet from scratch
        const wallet = generateWallet();
        walletAddress = wallet.address;

        // 2) Issue KYC VC (this will also register DID on-chain)
        const vcService = getVCDatabaseService();
        const issuer = getSystemAdminWallet();
        const issued = await vcService.issueVC({
          walletAddress: wallet.address,
          publicKeyHex: wallet.publicKey,
          vcType: 'KYC',
          data: {
            name: data.name,
            phoneNumber: data.phoneNumber || '',
            nationality: data.nationality || '',
            kycType: data.kycType || '',
          },
          issuerPrivateKey: issuer.privateKey,
        });

        // 3) Encrypt wallet mnemonic and VC JSON into vaults
        const walletVault = encryptVault(wallet.mnemonic, data.password);
        const vcVault = encryptVault(JSON.stringify(issued.vc), data.password);

        // 4) Store custody with both vaults
        // First create and save user to get userId
        const tempUser = userRepository.create({
          userId: randomUUID(),
          name: data.name,
          phoneNumber: data.phoneNumber || null,
          email: data.email || null,
          gender: data.gender || null,
          dateOfBirth: data.dateOfBirth || null,
          nationality: data.nationality || null,
          address: data.address || null,
          walletAddress: wallet.address,
          kycType: (data.kycType as KycType) || null,
          kycDocumentPath: data.kycDocumentPath || null,
          kycFacePath: data.kycFacePath || null,
          registrationType: RegistrationType.PAPERVOUCHER,
          ussdStatus: USSDStatus.NOT_APPLICABLE,
          isActive: true, // Paper Voucher is immediately active
          hasCustodyWallet: true, // Has custody wallet stored
          createdBy,
        });

        await userRepository.save(tempUser);

        // Store custody
        await custodyService.createCustody({
          userId: tempUser.userId,
          vault: walletVault,
          vc: { id: issued.vc.id, ...vcVault },
        });

        // Send gas subsidy for Paper Voucher users (one-time on registration)
        const pvSystemWallet = getSystemAdminWallet();
        await blockchainService.sendGasSubsidy(wallet.address, pvSystemWallet.privateKey);

        // Return user with QR data
        return {
          ...tempUser,
          qrData: {
            address: wallet.address,
            walletVault,
            custodyVault: { id: issued.vc.id, ...vcVault },
          },
        } as User & { qrData: { address: string; walletVault: unknown; custodyVault: unknown } };
      }

      default:
        throw new Error(`Invalid registration type: ${data.registrationType}`);
    }

    // Create user with common fields
    const user = userRepository.create({
      userId: randomUUID(),
      name: data.name,
      phoneNumber: data.phoneNumber || null,
      email: data.email || null,
      gender: data.gender || null,
      dateOfBirth: data.dateOfBirth || null,
      nationality: data.nationality || null,
      address: data.address || null,
      walletAddress,
      kycType: (data.kycType as KycType) || null,
      kycDocumentPath: data.kycDocumentPath || null,
      kycFacePath: data.kycFacePath || null,
      registrationType: RegistrationType[data.registrationType],
      ussdStatus,
      isActive: false, // All types start inactive except Paper Voucher (future)
      hasCustodyWallet: false, // Will be true after activation
      createdBy,
    });

    await userRepository.save(user);
    return user;
  }

  /**
   * Activate USSD user
   */
  async activateUssdUser(id: number): Promise<User | null> {
    await this.initialize();

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id } });

    if (!user) {
      return null;
    }

    // Check if user has USSD enabled
    if (user.ussdStatus === USSDStatus.NOT_APPLICABLE) {
      throw new Error('User does not have USSD service enabled');
    }

    if (user.ussdStatus === USSDStatus.ACTIVE) {
      throw new Error('USSD is already active for this user');
    }

    user.ussdStatus = USSDStatus.ACTIVE;
    user.hasCustodyWallet = true;

    await userRepository.save(user);
    return user;
  }

  /**
   * Activate USSD user with PIN (External USSD Service)
   *
   * Creates wallet, DID, VC, and custody for USSD user.
   * Similar to Paper Voucher flow but triggered by external USSD service.
   *
   * @param phoneNumber - User's phone number
   * @param pin - PIN for vault encryption (4-6 digits)
   * @returns User with walletAddress
   */
  async activateUssdUserWithPin(phoneNumber: string, pin: string): Promise<User> {
    await this.initialize();

    const userRepository = AppDataSource.getRepository(User);

    // Find user by phone number
    const user = await userRepository.findOne({
      where: { phoneNumber },
    });

    if (!user) {
      throw new Error('User not found with this phone number');
    }

    // Check if user is USSD type
    if (user.registrationType !== RegistrationType.USSD) {
      throw new Error('User is not a USSD wallet type');
    }

    // Check if already active
    if (user.ussdStatus === USSDStatus.ACTIVE) {
      throw new Error('USSD is already active for this user');
    }

    // Check if PENDING
    if (user.ussdStatus !== USSDStatus.PENDING) {
      throw new Error('User USSD status is not PENDING');
    }

    // 1) Generate wallet
    const wallet = generateWallet();

    // 2) Issue KYC VC (this will also register DID on-chain)
    const vcService = getVCDatabaseService();
    const issuer = getSystemAdminWallet();
    const issued = await vcService.issueVC({
      walletAddress: wallet.address,
      publicKeyHex: wallet.publicKey,
      vcType: 'KYC',
      data: {
        name: user.name,
        phoneNumber: user.phoneNumber || '',
        nationality: user.nationality || '',
        kycType: user.kycType || '',
      },
      issuerPrivateKey: issuer.privateKey,
    });

    // 3) Encrypt wallet mnemonic and VC JSON into vaults with PIN
    const walletVault = encryptVault(wallet.mnemonic, pin);
    const vcVault = encryptVault(JSON.stringify(issued.vc), pin);

    // 4) Store custody with both vaults
    await custodyService.createCustody({
      userId: user.userId,
      vault: walletVault,
      vc: { id: issued.vc.id, ...vcVault },
    });

    // 5) Update user
    user.walletAddress = wallet.address;
    user.ussdStatus = USSDStatus.ACTIVE;
    user.isActive = true;
    user.hasCustodyWallet = true;

    await userRepository.save(user);

    console.log(`✅ USSD user activated: ${user.phoneNumber} → ${wallet.address}`);

    return user;
  }

  /**
   * Update user profile
   */
  async updateUser(
    id: number,
    data: {
      name?: string;
      email?: string;
      gender?: string;
      dateOfBirth?: Date;
      nationality?: string;
      address?: string;
      isActive?: boolean;
    },
  ): Promise<User | null> {
    await this.initialize();

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id } });

    if (!user) {
      return null;
    }

    if (data.name !== undefined) user.name = data.name;
    if (data.email !== undefined) user.email = data.email;
    if (data.gender !== undefined) user.gender = data.gender;
    if (data.dateOfBirth !== undefined) user.dateOfBirth = data.dateOfBirth;
    if (data.nationality !== undefined) user.nationality = data.nationality;
    if (data.address !== undefined) user.address = data.address;
    if (data.isActive !== undefined) user.isActive = data.isActive;

    await userRepository.save(user);
    return user;
  }

  /**
   * Create event
   */
  async createEvent(
    data: {
      eventId: string;
      name: string;
      description?: string;
      startDate: Date;
      endDate: Date;
      amountPerDay: string;
      maxParticipants?: number;
    },
    createdBy: string,
  ): Promise<Event> {
    await this.initialize();

    const eventRepository = AppDataSource.getRepository(Event);

    // Check for existing eventId
    const existingEvent = await eventRepository.findOne({
      where: { eventId: data.eventId },
    });
    if (existingEvent) {
      throw new Error('Event ID already exists');
    }

    const event = eventRepository.create({
      eventId: data.eventId,
      name: data.name,
      description: data.description || null,
      startDate: data.startDate,
      endDate: data.endDate,
      amountPerDay: data.amountPerDay,
      maxParticipants: data.maxParticipants || 100,
      // 이벤트 생성 시 기본 비활성화 (운영 준비 전 상태)
      isActive: false,
      status: EventStatus.PENDING,
      createdBy,
    });

    await eventRepository.save(event);
    return event;
  }

  /**
   * Update event
   */
  async updateEvent(
    id: number,
    data: {
      name?: string;
      description?: string;
      startDate?: Date;
      endDate?: Date;
      maxParticipants?: number;
      status?: EventStatus;
      // Factory integration
      eventContractAddress?: string | null;
      deploymentTxHash?: string | null;
      // 운영 토글 (일시중지/재개)
      isActive?: boolean;
    },
  ): Promise<Event | null> {
    await this.initialize();

    const eventRepository = AppDataSource.getRepository(Event);
    const event = await eventRepository.findOne({ where: { id } });

    if (!event) {
      return null;
    }

    Object.assign(event, data);
    await eventRepository.save(event);
    return event;
  }

  /**
   * Update event by eventId (UUID)
   */
  async updateEventByEventId(
    eventId: string,
    data: {
      name?: string;
      description?: string;
      startDate?: Date;
      endDate?: Date;
      maxParticipants?: number;
      status?: EventStatus;
      // Factory integration
      eventContractAddress?: string | null;
      deploymentTxHash?: string | null;
      // 운영 토글 (일시중지/재개)
      isActive?: boolean;
    },
  ): Promise<Event | null> {
    await this.initialize();
    const eventRepository = AppDataSource.getRepository(Event);
    const event = await eventRepository.findOne({ where: { eventId } });
    if (!event) return null;
    Object.assign(event, data);
    await eventRepository.save(event);
    return event;
  }

  /**
   * Get events with pagination and filters
   */
  async getEvents(options: {
    status?: EventStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ events: Event[]; total: number }> {
    await this.initialize();

    const eventRepository = AppDataSource.getRepository(Event);
    const query = eventRepository.createQueryBuilder('event');

    if (options.status) {
      query.andWhere('event.status = :status', { status: options.status });
    }

    // eventType removed in MVP simplification

    const total = await query.getCount();

    query.orderBy('event.start_date', 'DESC');

    if (options.limit) {
      query.take(options.limit);
    }

    if (options.offset) {
      query.skip(options.offset);
    }

    const events = await query.getMany();

    return { events, total };
  }

  /**
   * Get event by ID
   */
  async getEventById(id: number): Promise<Event | null> {
    await this.initialize();

    const eventRepository = AppDataSource.getRepository(Event);
    return eventRepository.findOne({ where: { id } });
  }

  /**
   * Get event by eventId (UUID)
   */
  async getEventByEventId(eventId: string): Promise<Event | null> {
    await this.initialize();
    const eventRepository = AppDataSource.getRepository(Event);
    return eventRepository.findOne({ where: { eventId } });
  }

  /**
   * Assign staff to event
   */
  async assignStaff(data: { eventId: string; adminId: string; eventRole: EventRole }): Promise<EventStaff> {
    await this.initialize();

    const eventStaffRepository = AppDataSource.getRepository(EventStaff);

    const eventStaff = eventStaffRepository.create({
      eventId: data.eventId,
      adminId: data.adminId,
      eventRole: data.eventRole,
      assignedAt: new Date(),
    });

    await eventStaffRepository.save(eventStaff);
    return eventStaff;
  }

  /**
   * Get event staff
   */
  async getEventStaff(eventId: string): Promise<EventStaff[]> {
    await this.initialize();

    const eventStaffRepository = AppDataSource.getRepository(EventStaff);
    return eventStaffRepository.find({
      where: { eventId },
      order: { assignedAt: 'DESC' },
    });
  }

  // updateEventStaffRole 제거됨: UI에서 역할 변경 기능을 제거함(역할은 배정 시 확정)

  /**
   * Remove staff from event
   */
  async removeStaff(eventId: string, adminId: string): Promise<boolean> {
    await this.initialize();

    const eventStaffRepository = AppDataSource.getRepository(EventStaff);
    const staff = await eventStaffRepository.findOne({
      where: { eventId, adminId },
    });

    if (!staff) {
      return false;
    }

    await eventStaffRepository.remove(staff);
    return true;
  }

  /**
   * Register participant for event
   */
  async registerParticipant(data: {
    eventId: string;
    userId: string;
    assignedByAdminId?: string;
  }): Promise<EventParticipant> {
    await this.initialize();

    const eventParticipantRepository = AppDataSource.getRepository(EventParticipant);

    console.log('[AdminService] registerParticipant called', {
      eventId: data.eventId,
      userId: data.userId,
      assignedByAdminId: data.assignedByAdminId,
    });

    // Check for existing registration
    // 같은 이벤트에 동일 userId가 이미 등록되어 있으면 중복 방지
    const existing = await eventParticipantRepository.findOne({
      where: { eventId: data.eventId, userId: data.userId },
    });
    if (existing) {
      throw new Error('User already registered for this event');
    }

    // 온체인 등록이 성공한 이후에만 DB에 참가자 레코드를 생성
    const participant = eventParticipantRepository.create({
      eventId: data.eventId,
      userId: data.userId,
      assignedAt: new Date(),
      assignedByAdminId: data.assignedByAdminId ?? null,
    });

    await eventParticipantRepository.save(participant);
    console.log('[AdminService] Participant registered', {
      id: participant.id,
      eventId: participant.eventId,
      userId: participant.userId,
    });
    return participant;
  }

  /**
   * Get event participants
   */
  async getEventParticipants(eventId: string): Promise<EventParticipant[]> {
    await this.initialize();

    const eventParticipantRepository = AppDataSource.getRepository(EventParticipant);
    return eventParticipantRepository.find({
      where: { eventId },
      order: { assignedAt: 'DESC' },
    });
  }

  /**
   * Remove participant from event
   */
  async removeParticipant(eventId: string, userId: string): Promise<boolean> {
    await this.initialize();

    const eventParticipantRepository = AppDataSource.getRepository(EventParticipant);
    const participant = await eventParticipantRepository.findOne({
      where: { eventId, userId },
    });

    if (!participant) {
      return false;
    }

    await eventParticipantRepository.remove(participant);
    return true;
  }

  /**
   * Identify user by phone number for check-in
   */
  async identifyUserForCheckin(phoneNumber: string): Promise<User | null> {
    await this.initialize();

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { phoneNumber },
    });

    return user;
  }

  /**
   * Verify user PIN/password for check-in
   * TODO: Implement actual PIN verification logic
   */
  async verifyUserForCheckin(userId: string, pin: string): Promise<boolean> {
    await this.initialize();

    // TODO: Implement actual PIN verification
    // For now, accept any 4-digit PIN as valid
    if (pin.length === 4 && /^\d+$/.test(pin)) {
      return true;
    }

    return false;
  }

  /**
   * Check in participant
   */
  async checkInParticipant(data: {
    eventId: string;
    userId: string;
    checkedInByAdminId: string;
    checkinTxHash?: string | null;
  }): Promise<EventCheckin> {
    await this.initialize();

    const eventCheckinRepository = AppDataSource.getRepository(EventCheckin);

    // Check for existing check-in on the same day (per-event, per-day uniqueness)
    const existing = await eventCheckinRepository.findOne({
      where: { eventId: data.eventId, userId: data.userId },
      order: { checkedInAt: 'DESC' },
    });
    if (existing) {
      const MS_PER_DAY = 24 * 60 * 60 * 1000;
      const existingDay = Math.floor(existing.checkedInAt.getTime() / MS_PER_DAY);
      const todayDay = Math.floor(Date.now() / MS_PER_DAY);
      if (existingDay === todayDay) {
        throw new Error('User already checked in for this event today');
      }
    }

    const checkin = eventCheckinRepository.create({
      checkinId: randomUUID(),
      eventId: data.eventId,
      userId: data.userId,
      checkedInByAdminId: data.checkedInByAdminId,
      checkinTxHash: data.checkinTxHash ?? null,
      checkedInAt: new Date(),
    });

    await eventCheckinRepository.save(checkin);
    return checkin;
  }

  /**
   * Get event check-ins
   */
  async getEventCheckins(eventId: string): Promise<EventCheckin[]> {
    await this.initialize();

    const eventCheckinRepository = AppDataSource.getRepository(EventCheckin);
    return eventCheckinRepository.find({
      where: { eventId },
      order: { checkedInAt: 'DESC' },
    });
  }

  /**
   * Create payment record
   */
  async createPayment(data: {
    eventId: string;
    userId: string;
    checkinId: string;
    amount: string;
    paymentTxHash: string | null;
    paidByAdminId: string;
  }): Promise<EventPayment> {
    await this.initialize();

    const eventPaymentRepository = AppDataSource.getRepository(EventPayment);

    const payment = eventPaymentRepository.create({
      eventId: data.eventId,
      userId: data.userId,
      checkinId: data.checkinId,
      amount: data.amount,
      paidAt: new Date(),
      paidByAdminId: data.paidByAdminId,
      paymentTxHash: data.paymentTxHash,
    });

    await eventPaymentRepository.save(payment);
    return payment;
  }

  /**
   * Get event payments
   */
  async getEventPayments(eventId: string): Promise<EventPayment[]> {
    await this.initialize();

    const eventPaymentRepository = AppDataSource.getRepository(EventPayment);
    return eventPaymentRepository.find({
      where: { eventId },
      order: { createdAt: 'DESC' },
    });
  }
}

export const adminService = new AdminService();
