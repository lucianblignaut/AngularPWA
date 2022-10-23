import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, timeout, retry, catchError, TimeoutError, EMPTY, map, share, concat, of, throwError } from 'rxjs';
import { SyncToDo } from 'src/assets/models/syncToDo.model';
import { ConnectionService } from '../ConnectionService/connection.service';
import * as localforage from 'localforage';
import * as _ from 'lodash'

@Injectable({
  providedIn: 'root'
})
export class SyncService {

  public HTTP_TIMEOUT: number = 5000

  constructor(private http: HttpClient, private connection: ConnectionService) { }

  /**
   * Acts as a proxy for all outgoing HTTP POST requests. If a request could be made successfully,
   * the response is returned from the request. If a backend error occurs, error is handled accordingly,
   * if a network error occurs, queue the request for syncing. 
   * @param url 
   * @param payload 
   * @param params 
   * @returns Observable 
   */
  public tryPost<T>(url: string, payload: T, params: HttpParams): Observable<T> {
    return this.http.post<T>(url, payload, { params }).pipe(timeout(this.HTTP_TIMEOUT), retry(2), catchError((err: HttpErrorResponse) => this.handleError<T>(err, url, payload, 'post', params)), share())
  }
  /**
   * Acts as a proxy for all outgoing HTTP PUT requests. If a request could be made successfully,
   * the response is returned from the request. If a backend error occurs, error is handled accordingly,
   * if a network error occurs, queue the request for syncing.
   * @param url 
   * @param payload 
   * @param params 
   * @returns Observable
   */
  public tryPut<T>(url: string, payload: T, params: HttpParams): Observable<T> {
    return this.http.put<T>(url, payload, { params }).pipe(timeout(this.HTTP_TIMEOUT), retry(2), catchError((err: HttpErrorResponse) => this.handleError(err, url, payload, 'put', params)), share())
  }
  /**
   * Helper function that resolves a HTTP error response to either a queue of the request
   * or an RXJS error response in case of a backend fault.
   * @param err 
   * @param url 
   * @param payload 
   * @param method 
   * @param params 
   * @returns Observable
   */
  private handleError<T>(err: HttpErrorResponse, url: string, payload: T, method: 'post' | 'put', params: HttpParams): Observable<any> {
    if (this.offlineOrBadConnection(err)) {
      // A client-side or network error occurred. Handle it accordingly.
      console.log('handling error due to bad connection');
      // add call to queue to retry at a later time
      this.addOrUpdateSyncTask<T>(url, payload, method, params);
      return EMPTY
    } else {
      console.log('A backend error occurred.', err);
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong.
      throw err
    }
  }
  /**
   * Helper function that determines whether an error was frontend or backend related.
   * @param err 
   * @returns true if error was locally caused and false if it was backend related
   */
  private offlineOrBadConnection(err: HttpErrorResponse): boolean {
    return (
      err instanceof TimeoutError ||
      err.error instanceof ErrorEvent ||
      !this.connection.getOnlineStatus()  // A helper service that delegates connectivity with AJAX requests
    );
  }
  /**
   * Adds a HTTP request to the queue with the help of localForage indexedDB
   * @param url 
   * @param payload 
   * @param method 
   * @param params 
   */
  private addOrUpdateSyncTask<T>(url: string, payload: T, method: 'post' | 'put', params: HttpParams): void {
    this.getExistingSyncTasks().subscribe(tasks => {
      const syncTodo = new SyncToDo<T>(url, payload, params.toString(), method);
      tasks.push(syncTodo);
      localforage.setItem('pendingTodos', tasks).then(_ => {
        console.log('added new items to pendingTodos');
        alert('queued a new request locally :D')
      })
    })
  }
  /**
   * Queries the indexedDB with localForage to retrieve the queue of pending requests.
   * @returns an Observable array of synced todos
   */
  private getExistingSyncTasks(): Observable<SyncToDo<any>[]> {
    return new Observable(observer => {
      localforage.getItem('pendingTodos').then((tasks: any) => {
        observer.next(tasks ?? [])
        observer.complete()
      })
    })
  }
  /**
   * Kicks off the syncing procedure and sends all pending requests in order of the queue.
   * @returns an observable of synced todos
   */
  public sync(): Observable<any> {
    return new Observable(observer => {
      this.getExistingSyncTasks().subscribe(syncTasks => {
        let requests: Observable<SyncToDo<any>>[] = []
        syncTasks.forEach((task: SyncToDo<any>) => {
          const params = { params: new HttpParams({ fromString: task.params }) }
          const response$ = this.http[task.method](task.url, task.body, params).pipe(map(_ => task), retry(2))
          requests.push(response$);
        })

        const all$ = concat(...requests).pipe(share())

        all$.subscribe(task => {
          console.log('successfully synced task:', task);
          alert('successfully synced a todo!')
          const index = syncTasks.findIndex(t => _.isEqual(t, task))
          syncTasks.splice(index, 1)
          localforage.setItem('pendingTodos', syncTasks)
        })

        observer.next(all$)
      })
    })
  }
}
