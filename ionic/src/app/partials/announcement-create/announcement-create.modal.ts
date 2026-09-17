import { Component, OnDestroy } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { AnnouncementService } from '../../core/_base/layout/services/announcement.service';
import { Announcement, AnnouncementCreateResult } from '../../core/_base/layout/models/announcement.model';

type AnnouncementType = 'file' | 'tts';

interface FormData {
    name: string;
    enabled: boolean;
    type: AnnouncementType;
    lang: string;
    text: string;
}

@Component({
    selector: 'app-announcement-create-modal',
    templateUrl: './announcement-create.modal.html',
    styleUrls: ['./announcement-create.modal.scss'],
    standalone: false,
    providers: [AnnouncementService]
})
export class AnnouncementCreateModal implements OnDestroy {
    // Form data
    formData: FormData = {
        name: '',
        enabled: true,
        type: 'file',
        lang: 'en',
        text: ''
    };

    // File upload state
    selectedFile: File | null = null;
    filePreviewUrl: string | null = null;
    uploadProgress: number = 0;
    isUploading: boolean = false;

    // TTS state (for future use)
    ttsGeneratedPath: string | null = null;

    // Audio player state
    audioElement: HTMLAudioElement | null = null;
    isPlaying: boolean = false;
    audioProgress: number = 0;
    audioDuration: number = 0;
    currentTime: number = 0;

    // General state
    isSaving: boolean = false;

    // Available languages for TTS
    languages = [
        { code: 'en', name: 'English' },
        { code: 'he', name: 'Hebrew' }
    ];

    // Character limit for TTS
    maxTextLength = 500;

    constructor(
        private modalCtrl: ModalController,
        private toastCtrl: ToastController,
        private announcementService: AnnouncementService
    ) {}

    ngOnDestroy(): void {
        this.stopAudio();
        if (this.filePreviewUrl) {
            URL.revokeObjectURL(this.filePreviewUrl);
        }
    }

    canSave(): boolean {
        if (this.isSaving) return false;

        if (this.formData.type === 'file') {
            return this.selectedFile !== null;
        } else {
            return this.formData.text.trim().length > 0;
        }
    }

    getNamePlaceholder(): string {
        if (this.formData.type === 'file' && this.selectedFile) {
            return this.getFileNameWithoutExtension(this.selectedFile.name);
        }
        return '';
    }

    private getFileNameWithoutExtension(filename: string): string {
        const lastDot = filename.lastIndexOf('.');
        return lastDot > 0 ? filename.substring(0, lastDot) : filename;
    }

    private getEffectiveName(): string {
        if (this.formData.name.trim()) {
            return this.formData.name.trim();
        }
        if (this.formData.type === 'file' && this.selectedFile) {
            return this.getFileNameWithoutExtension(this.selectedFile.name);
        }
        // For TTS, use first few words of text
        if (this.formData.type === 'tts' && this.formData.text.trim()) {
            return this.formData.text.trim().substring(0, 30);
        }
        return 'Announcement';
    }

    // Type Selection
    selectType(type: AnnouncementType): void {
        this.formData.type = type;
        // Reset state when switching types
        if (type === 'file') {
            this.ttsGeneratedPath = null;
        } else {
            this.selectedFile = null;
            if (this.filePreviewUrl) {
                URL.revokeObjectURL(this.filePreviewUrl);
                this.filePreviewUrl = null;
            }
        }
        this.stopAudio();
    }

    // File Upload
    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            const file = input.files[0];

            // Validate file type
            const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav'];
            if (!validTypes.includes(file.type)) {
                this.showToast('Please select an MP3 or WAV file', 'warning');
                return;
            }

            // Validate file size (50MB max)
            const maxSize = 50 * 1024 * 1024;
            if (file.size > maxSize) {
                this.showToast('File size must be less than 50MB', 'warning');
                return;
            }

            this.selectedFile = file;

            // Create preview URL for local playback
            if (this.filePreviewUrl) {
                URL.revokeObjectURL(this.filePreviewUrl);
            }
            this.filePreviewUrl = URL.createObjectURL(file);
            this.stopAudio();
        }
    }

    removeFile(): void {
        this.selectedFile = null;
        if (this.filePreviewUrl) {
            URL.revokeObjectURL(this.filePreviewUrl);
            this.filePreviewUrl = null;
        }
        this.stopAudio();
    }

    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Audio Player
    togglePlayback(): void {
        if (!this.filePreviewUrl) return;

        if (this.isPlaying) {
            this.pauseAudio();
        } else {
            this.playAudio(this.filePreviewUrl);
        }
    }

    playAudio(url: string): void {
        if (this.audioElement) {
            this.stopAudio();
        }

        this.audioElement = new Audio(url);

        this.audioElement.onloadedmetadata = () => {
            this.audioDuration = this.audioElement?.duration || 0;
        };

        this.audioElement.ontimeupdate = () => {
            if (this.audioElement) {
                this.currentTime = this.audioElement.currentTime;
                this.audioProgress = (this.currentTime / this.audioDuration) * 100;
            }
        };

        this.audioElement.onended = () => {
            this.isPlaying = false;
            this.audioProgress = 0;
            this.currentTime = 0;
        };

        this.audioElement.onerror = () => {
            this.isPlaying = false;
            this.showToast('Unable to play audio preview', 'warning');
        };

        this.audioElement.play();
        this.isPlaying = true;
    }

    pauseAudio(): void {
        if (this.audioElement) {
            this.audioElement.pause();
            this.isPlaying = false;
        }
    }

    stopAudio(): void {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            this.audioElement = null;
        }
        this.isPlaying = false;
        this.audioProgress = 0;
        this.currentTime = 0;
    }

    formatTime(seconds: number): string {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Save
    async save(): Promise<void> {
        if (!this.canSave()) return;

        this.isSaving = true;
        const effectiveName = this.getEffectiveName();

        try {
            let result: Announcement;

            if (this.formData.type === 'file' && this.selectedFile) {
                result = await this.announcementService
                    .createWithFile(this.selectedFile, effectiveName, this.formData.enabled)
                    .toPromise() as Announcement;
            } else if (this.formData.type === 'tts' && this.formData.text.trim()) {
                // Server will generate TTS audio from text
                result = await this.announcementService
                    .createFromTts(
                        effectiveName,
                        this.formData.enabled,
                        '', // Server generates the audio
                        this.formData.lang,
                        this.formData.text
                    )
                    .toPromise() as Announcement;
            } else {
                throw new Error('Invalid form state');
            }

            const createResult: AnnouncementCreateResult = {
                uuid: result.uuid!,
                name: result.name,
                type: this.formData.type,
                path: result.path || result.url || result.file_url,
                url: result.url || result.file_url || result.path
            };

            this.showToast('Announcement created successfully', 'success');
            this.modalCtrl.dismiss(createResult, 'save');

        } catch (error) {
            console.error('Failed to create announcement:', error);
            this.showToast('Failed to create announcement', 'danger');
        } finally {
            this.isSaving = false;
        }
    }

    dismiss(): void {
        this.modalCtrl.dismiss(null, 'cancel');
    }

    private async showToast(message: string, color: string): Promise<void> {
        const toast = await this.toastCtrl.create({
            message,
            duration: 3000,
            color,
            position: 'bottom'
        });
        toast.present();
    }
}
