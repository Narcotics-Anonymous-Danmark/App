import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface LoadingState {
  visible: boolean;
  text: string;
}

const INITIAL_STATE: LoadingState = { visible: false, text: '' };

@Injectable({
  providedIn: 'root'
})
export class LoadingService {

  private count = 0;
  private readonly stateSubject = new BehaviorSubject<LoadingState>(INITIAL_STATE);
  readonly state$ = this.stateSubject.asObservable();

  present(text: string = '') {
    this.count++;
    this.stateSubject.next({ visible: true, text });
  }

  dismiss() {
    this.count = Math.max(0, this.count - 1);
    if (this.count === 0) {
      this.stateSubject.next(INITIAL_STATE);
    }
  }
}
