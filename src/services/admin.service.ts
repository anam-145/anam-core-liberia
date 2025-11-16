import { AppDataSource } from '@/server/db/datasource';
import type { AdminRole } from '@/server/db/entities/Admin';
import { Admin, OnboardingStatus } from '@/server/db/entities/Admin';
import type { KycType } from '@/server/db/entities/User';
import { User, KycStatus, WalletType, UserStatus } from '@/server/db/entities/User';
import { Event, EventStatus } from '@/server/db/entities/Event';
import type { EventRole } from '@/server/db/entities/EventStaff';
import { EventStaff } from '@/server/db/entities/EventStaff';
import { EventParticipant, RegistrationStatus } from '@/server/db/entities/EventParticipant';
import { EventCheckin } from '@/server/db/entities/EventCheckin';
import type { PaymentMethod } from '@/server/db/entities/EventPayment';
import { EventPayment, PaymentStatus } from '@/server/db/entities/EventPayment';
import { hash, compare } from 'bcryptjs';
import type { VerifiablePresentation } from '@/utils/crypto/did';
import { randomUUID } from 'crypto';

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
    kycStatus?: KycStatus;
    walletType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: User[]; total: number }> {
    await this.initialize();

    const userRepository = AppDataSource.getRepository(User);
    const query = userRepository.createQueryBuilder('user');

    if (options.kycStatus) {
      query.andWhere('user.kyc_status = :kycStatus', { kycStatus: options.kycStatus });
    }

    if (options.walletType) {
      query.andWhere('user.wallet_type = :walletType', { walletType: options.walletType });
    }

    const total = await query.getCount();

    query.orderBy('user.created_at', 'DESC');

    if (options.limit) {
      query.take(options.limit);
    }

    if (options.offset) {
      query.skip(options.offset);
    }

    const users = await query.getMany();

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
   * Create a new user
   */
  async createUser(
    data: {
      name: string;
      phoneNumber: string;
      email?: string;
      gender?: string;
      dateOfBirth?: Date;
      nationality?: string;
      address?: string;
      walletType: string;
      kycType?: string;
      kycDocumentNumber?: string;
    },
    createdBy: string,
  ): Promise<User> {
    await this.initialize();

    const userRepository = AppDataSource.getRepository(User);

    // Check for existing phone number
    const existingPhone = await userRepository.findOne({
      where: { phoneNumber: data.phoneNumber },
    });
    if (existingPhone) {
      throw new Error('Phone number already exists');
    }

    const user = userRepository.create({
      userId: randomUUID(),
      name: data.name,
      phoneNumber: data.phoneNumber,
      email: data.email || null,
      gender: data.gender || null,
      dateOfBirth: data.dateOfBirth || null,
      nationality: data.nationality || null,
      address: data.address || null,
      walletType: data.walletType as WalletType,
      kycType: (data.kycType as KycType) || null,
      kycDocumentNumber: data.kycDocumentNumber || null,
      kycStatus: KycStatus.PENDING,
      userStatus: UserStatus.PENDING_KYC, // 설계서에 따라 기본값은 PENDING_KYC
      createdBy,
    });

    await userRepository.save(user);
    return user;
  }

  /**
   * Update user KYC information
   */
  async updateUserKyc(
    id: number,
    data: {
      kycType?: string;
      kycDocumentNumber?: string;
      kycDocumentPath?: string;
      kycFacePath?: string;
      kycStatus?: KycStatus;
    },
  ): Promise<User | null> {
    await this.initialize();

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id } });

    if (!user) {
      return null;
    }

    if (data.kycType !== undefined) user.kycType = (data.kycType as KycType) || null;
    if (data.kycDocumentNumber !== undefined) user.kycDocumentNumber = data.kycDocumentNumber;
    if (data.kycDocumentPath !== undefined) user.kycDocumentPath = data.kycDocumentPath;
    if (data.kycFacePath !== undefined) user.kycFacePath = data.kycFacePath;
    if (data.kycStatus !== undefined) user.kycStatus = data.kycStatus;

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

    // Check if user is USSD type
    if (user.walletType !== WalletType.USSD) {
      throw new Error('User is not a USSD wallet type');
    }

    user.userStatus = UserStatus.ACTIVE;

    await userRepository.save(user);
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
      userStatus?: string;
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
    if (data.userStatus !== undefined) user.userStatus = data.userStatus as UserStatus;

    await userRepository.save(user);
    return user;
  }

  /**
   * Approve user KYC
   */
  async approveKyc(userId: number, adminId: string): Promise<User | null> {
    await this.initialize();

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return null;
    }

    user.kycStatus = KycStatus.APPROVED;
    user.kycVerifiedBy = adminId;

    await userRepository.save(user);
    return user;
  }

  /**
   * Reject user KYC
   */
  async rejectKyc(userId: number): Promise<User | null> {
    await this.initialize();

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id: userId } });

    if (!user) {
      return null;
    }

    user.kycStatus = KycStatus.REJECTED;
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
      isActive: true,
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
  async registerParticipant(data: { eventId: string; userId: string }): Promise<EventParticipant> {
    await this.initialize();

    const eventParticipantRepository = AppDataSource.getRepository(EventParticipant);

    // Check for existing registration
    const existing = await eventParticipantRepository.findOne({
      where: { eventId: data.eventId, userId: data.userId },
    });
    if (existing) {
      throw new Error('User already registered for this event');
    }

    const participant = eventParticipantRepository.create({
      eventId: data.eventId,
      userId: data.userId,
      registrationStatus: RegistrationStatus.REGISTERED,
      registeredAt: new Date(),
    });

    await eventParticipantRepository.save(participant);
    return participant;
  }

  /**
   * Update participant status
   */
  async updateParticipantStatus(id: number, status: RegistrationStatus): Promise<EventParticipant | null> {
    await this.initialize();

    const eventParticipantRepository = AppDataSource.getRepository(EventParticipant);
    const participant = await eventParticipantRepository.findOne({ where: { id } });

    if (!participant) {
      return null;
    }

    participant.registrationStatus = status;

    if (status === RegistrationStatus.CONFIRMED) {
      participant.confirmedAt = new Date();
    } else if (status === RegistrationStatus.CANCELLED) {
      participant.cancelledAt = new Date();
    }

    await eventParticipantRepository.save(participant);
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
      order: { registeredAt: 'DESC' },
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
      where: { phoneNumber, kycStatus: KycStatus.APPROVED },
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
    checkedInBy: string;
    vpData?: VerifiablePresentation;
  }): Promise<EventCheckin> {
    await this.initialize();

    const eventCheckinRepository = AppDataSource.getRepository(EventCheckin);

    // Check for existing check-in
    const existing = await eventCheckinRepository.findOne({
      where: { eventId: data.eventId, userId: data.userId },
    });
    if (existing) {
      throw new Error('User already checked in for this event');
    }

    const checkin = eventCheckinRepository.create({
      eventId: data.eventId,
      userId: data.userId,
      checkedInBy: data.checkedInBy,
      vpData: data.vpData || null,
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
    amount: string;
    paymentMethod: PaymentMethod;
    transactionId?: string;
  }): Promise<EventPayment> {
    await this.initialize();

    const eventPaymentRepository = AppDataSource.getRepository(EventPayment);

    const payment = eventPaymentRepository.create({
      eventId: data.eventId,
      userId: data.userId,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      transactionId: data.transactionId || null,
      paymentStatus: PaymentStatus.PENDING,
    });

    await eventPaymentRepository.save(payment);
    return payment;
  }

  /**
   * Verify payment
   */
  async verifyPayment(id: number, verifiedBy: string): Promise<EventPayment | null> {
    await this.initialize();

    const eventPaymentRepository = AppDataSource.getRepository(EventPayment);
    const payment = await eventPaymentRepository.findOne({ where: { id } });

    if (!payment) {
      return null;
    }

    payment.paymentStatus = PaymentStatus.COMPLETED;
    payment.paidAt = new Date();
    payment.verifiedBy = verifiedBy;

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
